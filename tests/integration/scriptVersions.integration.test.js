/**
 * Script version history (Script tab audit, 2026-10-15: "there's no undo,
 * and Regenerate replaces the whole script"). Each writer that replaces an
 * episode's script keeps the one it replaces: Save, a lock that saves, and
 * Regenerate. The list is newest first without text; one version has it.
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
const { snapshotScript, KEEP, KEEP_GENERATED } = require('../../src/services/scriptVersions');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const beat = (n, name, body) => `## BEAT: ${n} · ${name}\n${body}`;
const V1 = beat(1, 'Opening Ritual', 'Lala: "First draft"');
const V2 = beat(1, 'Opening Ritual', 'Lala: "Second draft"');
const V3 = beat(1, 'Opening Ritual', 'Lala: "Third draft"');

(shouldSkip ? describe.skip : describe)('Script version history', () => {
  const show = uuid();
  const ep = uuid();
  let token;
  const keyBefore = process.env.ANTHROPIC_API_KEY;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: `test-versions-${show.slice(0, 8)}`, email: 'v@versions.dev', name: 'Versions', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())`, { id: show, n: `versions-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 1, 'draft', :script, NOW(), NOW())`, { ep, show, script: V1 });
    await run(`INSERT INTO episode_briefs (id, episode_id, status, created_at, updated_at) VALUES (:id, :ep, 'draft', NOW(), NOW())`, { id: uuid(), ep });
    process.env.ANTHROPIC_API_KEY = 'test-key-not-called';
  });

  afterAll(async () => {
    if (keyBefore === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = keyBefore;
    await run(`DELETE FROM episode_script_versions WHERE episode_id = :ep`, { ep });
    await run(`DELETE FROM episode_briefs WHERE episode_id = :ep`, { ep });
    await run(`DELETE FROM episodes WHERE id = :ep`, { ep });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  // Each script write carries the revision the page read (A1c R1).
  const rev = async () => (await auth(request(app).get(`/api/v1/episodes/${ep}`))).body.script_revision;
  const list = async () => (await auth(request(app).get(`/api/v1/episodes/${ep}/script-versions`))).body.data;

  test('a save keeps the script it replaces; saving the same text keeps nothing', async () => {
    expect((await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: V2, script_revision: await rev() })).status).toBe(200);
    await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: V2, script_revision: await rev() });
    const versions = await list();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ source: 'save', restore: false, beats: 1, preview: 'Lala: "First draft"' });
    expect(versions[0].script_content).toBeUndefined();
    // History audit H1 (2026-10-24): the list read v.created_at, which a
    // model with timestamps names createdAt, so every version had no date.
    expect(typeof versions[0].created_at).toBe('string');
    expect(Number.isNaN(Date.parse(versions[0].created_at))).toBe(false);
    expect(Math.abs(Date.now() - Date.parse(versions[0].created_at))).toBeLessThan(10 * 60 * 1000);
  });

  test('a lock that saves keeps the script it replaces', async () => {
    const res = await auth(request(app).put(`/api/v1/episodes/${ep}/script-locks`)).send({ locked_beats: [], script_content: V3, script_revision: await rev() });
    expect(res.status).toBe(200);
    expect((await list()).map((v) => v.source)).toEqual(['lock', 'save']);
  });

  test('Regenerate keeps the script it replaces', async () => {
    generateGroundedScript.mockResolvedValueOnce(beat(1, 'Opening Ritual', 'Lala: "Generated"'));
    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-script`)).send({ showId: show, confirmOverwrite: true });
    expect(res.status).toBe(200);
    const versions = await list();
    expect(versions.map((v) => v.source)).toEqual(['generate', 'lock', 'save']);
    const one = await auth(request(app).get(`/api/v1/episodes/${ep}/script-versions/${versions[0].id}`));
    expect(one.status).toBe(200);
    expect(one.body.data.script_content).toBe(V3);
    expect(Number.isNaN(Date.parse(one.body.data.created_at))).toBe(false);
  });

  test("another episode's version, or none, is not found", async () => {
    expect((await auth(request(app).get(`/api/v1/episodes/${uuid()}/script-versions/${(await list())[0].id}`))).status).toBe(404);
    expect((await auth(request(app).get(`/api/v1/episodes/${ep}/script-versions/${uuid()}`))).status).toBe(404);
  });

  // History audit H6 (2026-10-24): the cap is per family, so many saves
  // never push out the script from before a Regenerate.
  test(`only the newest ${KEEP} saves and the newest ${KEEP_GENERATED} generated are kept, each apart`, async () => {
    const episode = await models.Episode.findByPk(ep);
    for (let i = 0; i < KEEP_GENERATED + 2; i += 1) {
      episode.script_content = beat(1, 'Opening Ritual', `Lala: "Generated take ${i}"`);
      // eslint-disable-next-line no-await-in-loop
      await snapshotScript(models, episode, { source: 'generate' });
    }
    for (let i = 0; i < KEEP + 2; i += 1) {
      episode.script_content = beat(1, 'Opening Ritual', `Lala: "Take ${i}"`);
      // eslint-disable-next-line no-await-in-loop
      await snapshotScript(models, episode, { source: i % 3 === 0 ? 'lock' : 'save' });
    }
    const [rows] = await run(`SELECT source, COUNT(*)::int AS n FROM episode_script_versions WHERE episode_id = :ep GROUP BY source`, { ep });
    const by = Object.fromEntries(rows.map((r) => [r.source, r.n]));
    expect((by.save || 0) + (by.lock || 0)).toBe(KEEP);
    expect(by.generate).toBe(KEEP_GENERATED);
    // The newest generated one is still there after 52 saves.
    const [[newest]] = await run(`SELECT script_content FROM episode_script_versions WHERE episode_id = :ep AND source = 'generate' ORDER BY created_at DESC LIMIT 1`, { ep });
    expect(newest.script_content).toContain(`Generated take ${KEEP_GENERATED + 1}`);
    expect(await list()).toHaveLength(KEEP + KEEP_GENERATED);
  });
});
