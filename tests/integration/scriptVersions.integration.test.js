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
const { snapshotScript, KEEP } = require('../../src/services/scriptVersions');

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
  const list = async () => (await auth(request(app).get(`/api/v1/episodes/${ep}/script-versions`))).body.data;

  test('a save keeps the script it replaces; saving the same text keeps nothing', async () => {
    expect((await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: V2 })).status).toBe(200);
    await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: V2 });
    const versions = await list();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ source: 'save', beats: 1, preview: 'Lala: "First draft"' });
    expect(versions[0].script_content).toBeUndefined();
  });

  test('a lock that saves keeps the script it replaces', async () => {
    const res = await auth(request(app).put(`/api/v1/episodes/${ep}/script-locks`)).send({ locked_beats: [], script_content: V3 });
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
  });

  test("another episode's version, or none, is not found", async () => {
    expect((await auth(request(app).get(`/api/v1/episodes/${uuid()}/script-versions/${(await list())[0].id}`))).status).toBe(404);
    expect((await auth(request(app).get(`/api/v1/episodes/${ep}/script-versions/${uuid()}`))).status).toBe(404);
  });

  test(`only the newest ${KEEP} are kept`, async () => {
    const episode = await models.Episode.findByPk(ep);
    for (let i = 0; i < KEEP + 2; i += 1) {
      episode.script_content = beat(1, 'Opening Ritual', `Lala: "Take ${i}"`);
      // eslint-disable-next-line no-await-in-loop
      await snapshotScript(models, episode, { source: 'save' });
    }
    const [[{ n }]] = await run(`SELECT COUNT(*)::int AS n FROM episode_script_versions WHERE episode_id = :ep`, { ep });
    expect(n).toBe(KEEP);
  });
});
