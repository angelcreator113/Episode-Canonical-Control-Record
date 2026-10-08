/**
 * Locked script beats (Evoni, 2026-10-08: "yes start with lock then drag
 * and drop"). Approving a beat locks it on the episode; Save can't change
 * it, and Regenerate rewrites only the unlocked beats.
 */
jest.unmock('uuid');
jest.mock('../../src/services/groundedScriptGeneratorService', () => ({
  generateGroundedScript: jest.fn(),
}));

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

const beat = (n, name, body) => `## BEAT: ${n} · ${name}\n${body}`;
const script = (...beats) => beats.join('\n\n');
const ORIGINAL = script(beat(1, 'Opening Ritual', 'Prime: "Hey besties"'), beat(2, 'Login Sequence', 'Lala: "Logging in"'), beat(3, 'Welcome', 'Lala: "Welcome back"'));

(shouldSkip ? describe.skip : describe)('Script beat locks', () => {
  const show = uuid();
  const ep = uuid();
  let token;
  const keyBefore = process.env.ANTHROPIC_API_KEY;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: `test-locks-${show.slice(0, 8)}`, email: 'l@locks.dev', name: 'Locks', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())`, { id: show, n: `locks-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 1, 'draft', :script, NOW(), NOW())`, { ep, show, script: ORIGINAL });
    await run(`INSERT INTO episode_briefs (id, episode_id, status, created_at, updated_at) VALUES (:id, :ep, 'draft', NOW(), NOW())`, { id: uuid(), ep });
    process.env.ANTHROPIC_API_KEY = 'test-key-not-called';
  });

  afterAll(async () => {
    if (keyBefore === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = keyBefore;
    await run(`DELETE FROM episode_briefs WHERE episode_id = :ep`, { ep });
    await run(`DELETE FROM episodes WHERE id = :ep`, { ep });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const locks = (body) => auth(request(app).put(`/api/v1/episodes/${ep}/script-locks`)).send(body);
  const stored = async () => (await run(`SELECT script_content, script_locked_beats FROM episodes WHERE id = :ep`, { ep }))[0][0];

  test('approving a beat keeps the lock on the episode, and the episode returns it', async () => {
    const res = await locks({ locked_beats: [2] });
    expect(res.status).toBe(200);
    expect(res.body.data.script_locked_beats).toEqual([2]);
    const got = await auth(request(app).get(`/api/v1/episodes/${ep}`));
    expect(got.body.data.script_locked_beats).toEqual([2]);
  });

  test('a lock that is not a list of beat numbers is refused', async () => {
    expect((await locks({ locked_beats: 2 })).status).toBe(400);
    expect((await locks({ locked_beats: [2, 99] })).status).toBe(400);
    expect((await stored()).script_locked_beats).toEqual([2]);
  });

  test("Save can't change a locked beat: it is put back and named", async () => {
    const edited = ORIGINAL.replace('Logging in', 'Changed while locked').replace('Welcome back', 'Welcome, besties');
    const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: edited });
    expect(res.status).toBe(200);
    expect(res.body.locked_beats_kept).toEqual([2]);
    const row = await stored();
    expect(row.script_content).toContain('Lala: "Logging in"');
    expect(row.script_content).toContain('Welcome, besties');
  });

  test('locking with unsaved edits saves them, and the new beat locks as shown', async () => {
    const { script_content: current } = await stored();
    const res = await locks({ locked_beats: [2, 3], script_content: current.replace('Welcome, besties', 'Welcome to the gala') });
    expect(res.status).toBe(200);
    expect(res.body.data.script_locked_beats).toEqual([2, 3]);
    expect((await stored()).script_content).toContain('Welcome to the gala');
  });

  test('Regenerate rewrites only the unlocked beats', async () => {
    generateGroundedScript.mockResolvedValueOnce(script(
      beat(1, 'Opening Ritual', 'Prime: "Brand new opening"'),
      beat(2, 'Login Sequence', 'Lala: "Brand new login"'),
      beat(3, 'Welcome', 'Lala: "Brand new welcome"'),
    ));
    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-script`)).send({ showId: show, confirmOverwrite: true });
    expect(res.status).toBe(200);
    expect(res.body.locked_kept).toEqual([2, 3]);
    const row = await stored();
    expect(row.script_content).toBe(script(
      beat(1, 'Opening Ritual', 'Prime: "Brand new opening"'),
      beat(2, 'Login Sequence', 'Lala: "Logging in"'),
      beat(3, 'Welcome', 'Lala: "Welcome to the gala"'),
    ));
    expect(res.body.script).toBe(row.script_content);
  });

  test('unlocking lets Save change the beat again', async () => {
    expect((await locks({ locked_beats: [] })).body.data.script_locked_beats).toEqual([]);
    const { script_content: current } = await stored();
    const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: current.replace('Logging in', 'Logged in') });
    expect(res.body.locked_beats_kept).toBeUndefined();
    expect((await stored()).script_content).toContain('Logged in');
  });
});
