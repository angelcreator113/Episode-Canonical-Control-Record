/**
 * Readiness gates (audit findings GATE-01, GATE-02, GATE-03; 2026-10-03), on
 * the migrated database through the real routes:
 *   - the beat plan reads complete only with the 14 canonical beats, and
 *     script-context is ready only when they are all locked;
 *   - wardrobe slot coverage names the required slots with no piece;
 *   - a script generated but not saved comes back saying so, with the
 *     script, and saving later never regenerates it.
 */
jest.unmock('uuid');

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n';
jest.mock('../../src/services/groundedScriptGeneratorService', () => ({
  generateGroundedScript: jest.fn(async () => SCRIPT),
  buildScriptPrompt: jest.fn(),
}));
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-never-used';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { generateGroundedScript } = require('../../src/services/groundedScriptGeneratorService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Readiness gates (audit GATE-01..03)', () => {
  const show = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function episode() {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gates ep', :n, 'draft', NOW(), NOW())`, { ep, show, n: Math.floor(Math.random() * 100000) + 700 });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at)
               VALUES (:id, :ep, :show, 'draft', NOW(), NOW())`, { id: uuid(), ep, show });
    return ep;
  }
  const addBeats = (ep, numbers) => Promise.all(numbers.map((b) => run(
    `INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, sort_order, locked, ai_suggested, created_at, updated_at)
     VALUES (gen_random_uuid(), :ep, :b, :name, :b, false, false, NOW(), NOW())`, { ep, b, name: `Beat ${b}` })));
  const plan = (ep) => auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`));
  const scriptContext = (ep) => auth(request(app).get(`/api/v1/episode-brief/${ep}/script-context`));

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-gates', email: 'user@gates.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Gates ${show.slice(0, 8)}`, slug: `gates-${show.slice(0, 8)}` });
  });

  test('GATE-01: one beat is not a plan; fourteen is; script-context is ready only once they are locked', async () => {
    const ep = await episode();
    let res = await plan(ep);
    expect(res.status).toBe(200);
    expect(res.body.coverage).toMatchObject({ complete: false, present: 0, expected: 14 });
    let ctx = await scriptContext(ep);
    expect(ctx.body).toMatchObject({ ready: false, count: 0 });
    expect(ctx.body.message).toMatch(/^Beat plan incomplete: 0 of 14 beats/);

    await addBeats(ep, [1]);
    res = await plan(ep);
    expect(res.body.coverage).toMatchObject({ complete: false, present: 1, text: '1 of 14 beats · missing beats 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 and 14' });
    ctx = await scriptContext(ep);
    expect(ctx.body.ready).toBe(false);

    await addBeats(ep, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    res = await plan(ep);
    expect(res.body.coverage).toMatchObject({ complete: true, present: 14, missing: [], text: '14 of 14 beats' });
    ctx = await scriptContext(ep);
    expect(ctx.body).toMatchObject({ ready: false, message: '14 beats still unlocked.' });
    expect(ctx.body.coverage.complete).toBe(true);

    expect((await auth(request(app).post(`/api/v1/episode-brief/${ep}/plan/lock-all`))).status).toBe(200);
    ctx = await scriptContext(ep);
    expect(ctx.body).toMatchObject({ ready: true, message: 'All beats locked — ready for script generation.' });
  });

  test('GATE-02: slot coverage names the required slots with no piece, from the show\'s own configuration', async () => {
    const url = `/api/v1/wardrobe/slot-coverage?show_id=${show}`;
    let res = await auth(request(app).get(url));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ show_id: show, required_slots: ['outfit', 'shoes'], inventory: 0, covered: false, missing: ['outfit', 'shoes'], text: 'No wardrobe pieces uploaded' });

    await run(`INSERT INTO wardrobe (name, clothing_category, show_id, created_at, updated_at) VALUES ('Red heels', 'heels', :show, NOW(), NOW())`, { show });
    res = await auth(request(app).get(url));
    expect(res.body.data).toMatchObject({ inventory: 1, covered: false, missing: ['outfit'], text: 'Missing required slot: outfit' });

    await run(`INSERT INTO wardrobe (name, clothing_category, show_id, created_at, updated_at) VALUES ('Gala dress', 'dress', :show, NOW(), NOW())`, { show });
    res = await auth(request(app).get(url));
    expect(res.body.data).toMatchObject({ inventory: 2, covered: true, missing: [], text: 'Required slots covered: outfit, shoes' });

    await run(`UPDATE shows SET metadata = '{"required_slots": ["outfit", "shoes", "jewelry", "accessories", "fragrance"]}'::jsonb WHERE id = :show`, { show });
    res = await auth(request(app).get(url));
    expect(res.body.data).toMatchObject({ covered: false, missing: ['jewelry', 'accessories', 'fragrance'], text: 'Missing required slots: jewelry, accessories, fragrance' });
    expect(res.body.data.slots.map((s) => [s.slot, s.required, s.count])).toEqual([
      ['outfit', true, 1], ['shoes', true, 1], ['jewelry', true, 0], ['accessories', true, 0], ['fragrance', true, 0],
    ]);

    expect((await auth(request(app).get('/api/v1/wardrobe/slot-coverage'))).status).toBe(400);
    expect((await auth(request(app).get(`/api/v1/wardrobe/slot-coverage?show_id=${uuid()}`))).status).toBe(404);
  });

  test('GATE-03: a script generated but not saved says so and keeps the script; saving later does not regenerate', async () => {
    const ep = await episode();
    const generate = () => auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-script`)).send({ showId: show });
    jest.spyOn(models.Episode.prototype, 'update').mockRejectedValueOnce(new Error('disk full'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const failed = await generate();
    expect(failed.status).toBe(200);
    expect(failed.body).toMatchObject({
      success: false, saved: false, code: 'SCRIPT_GENERATED_NOT_SAVED', script: SCRIPT,
      error: 'The script was generated but could not be saved: disk full',
    });
    expect(failed.body.beats).toEqual([{ number: 1, name: 'Opening Ritual' }]);
    expect(spy).toHaveBeenCalledWith('[ScriptGen] Could not save to episode:', 'disk full');
    spy.mockRestore();
    const [before] = await rows('SELECT script_content FROM episodes WHERE id = :ep', { ep });
    expect(before.script_content).toBeNull();

    // The caller keeps the draft and saves it; no second generation.
    const calls = generateGroundedScript.mock.calls.length;
    const saved = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: failed.body.script });
    expect(saved.status).toBe(200);
    expect(generateGroundedScript.mock.calls.length).toBe(calls);
    const [after] = await rows('SELECT script_content FROM episodes WHERE id = :ep', { ep });
    expect(after.script_content).toBe(SCRIPT);

    // A save that works is success.
    const ok = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-script`)).send({ showId: show, confirmOverwrite: true });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ success: true, saved: true, script: SCRIPT });
    expect(ok.body.code).toBeUndefined();
  });
});
