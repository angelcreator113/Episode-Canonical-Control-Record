/**
 * The legacy cue routes on the shared connection (the shared-connection
 * repair, 2026-11-06).
 *
 * src/db.js now uses the app's SSL-aware pool, so these routes reach the
 * database. Their tables (icon_cues, cursor_actions, music_cues,
 * production_packages, icon_slot_mappings, lala_formula_episodes) exist only
 * in the retired root migration tree, not in production and not in the
 * migrated test database; this repair does not create them. So every route
 * must now fail on the missing table, inside the database, and answer it:
 * a JSON error, never a crash, no AI call, no S3 upload, and no row written
 * to a table that exists.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const { getPool } = require('../../src/config/database');
const db = require('../../src/db');
const productionPackageService = require('../../src/services/productionPackageService');

const url = process.env.DATABASE_URL;
const shouldSkip = !url || url.includes('amazonaws.com') || !url.includes('episode_metadata_test');

const LEGACY_TABLES = ['icon_cues', 'cursor_actions', 'music_cues', 'production_packages', 'icon_slot_mappings', 'lala_formula_episodes'];

const ROUTES = (ep, id) => [
  ['post', `/api/v1/episodes/${ep}/icon-cues/generate`], ['post', `/api/v1/episodes/${ep}/icon-cues/regenerate`],
  ['get', `/api/v1/episodes/${ep}/icon-cues`], ['get', `/api/v1/episodes/${ep}/icon-cues/${id}`],
  ['post', `/api/v1/episodes/${ep}/icon-cues`], ['put', `/api/v1/episodes/${ep}/icon-cues/${id}`],
  ['delete', `/api/v1/episodes/${ep}/icon-cues/${id}`], ['post', `/api/v1/episodes/${ep}/icon-cues/${id}/approve`],
  ['post', `/api/v1/episodes/${ep}/icon-cues/${id}/reject`], ['post', `/api/v1/episodes/${ep}/icon-cues/approve-all`],
  ['post', `/api/v1/episodes/${ep}/icon-cues/reject-all`], ['get', `/api/v1/episodes/${ep}/icon-cues/anchors`],
  ['post', `/api/v1/episodes/${ep}/icon-cues/${id}/set-anchor`], ['delete', `/api/v1/episodes/${ep}/icon-cues/${id}/remove-anchor`],
  ['get', `/api/v1/episodes/${ep}/icon-cues/export`],
  ['post', `/api/v1/episodes/${ep}/cursor-paths/generate`], ['post', `/api/v1/episodes/${ep}/cursor-paths/regenerate`],
  ['get', `/api/v1/episodes/${ep}/cursor-paths`], ['get', `/api/v1/episodes/${ep}/cursor-paths/${id}`],
  ['post', `/api/v1/episodes/${ep}/cursor-paths`], ['put', `/api/v1/episodes/${ep}/cursor-paths/${id}`],
  ['delete', `/api/v1/episodes/${ep}/cursor-paths/${id}`], ['post', `/api/v1/episodes/${ep}/cursor-paths/${id}/approve`],
  ['post', `/api/v1/episodes/${ep}/cursor-paths/${id}/reject`], ['post', `/api/v1/episodes/${ep}/cursor-paths/approve-all`],
  ['get', `/api/v1/episodes/${ep}/cursor-paths/export`],
  ['post', `/api/v1/episodes/${ep}/music-cues/generate`], ['get', `/api/v1/episodes/${ep}/music-cues`],
  ['get', `/api/v1/episodes/${ep}/music-cues/${id}`], ['post', `/api/v1/episodes/${ep}/music-cues`],
  ['put', `/api/v1/episodes/${ep}/music-cues/${id}`], ['delete', `/api/v1/episodes/${ep}/music-cues/${id}`],
  ['post', `/api/v1/episodes/${ep}/music-cues/${id}/approve`], ['post', `/api/v1/episodes/${ep}/music-cues/approve-all`],
  ['get', `/api/v1/episodes/${ep}/music-cues/export`],
  ['post', `/api/v1/episodes/${ep}/production-package/generate`], ['get', `/api/v1/episodes/${ep}/production-package/latest`],
  ['get', `/api/v1/episodes/${ep}/production-package/versions`], ['get', `/api/v1/episodes/${ep}/production-package/${id}`],
  ['get', `/api/v1/episodes/${ep}/production-package/${id}/download`], ['delete', `/api/v1/episodes/${ep}/production-package/${id}`],
  ['get', '/api/v1/icon-slots/mappings'], ['get', '/api/v1/icon-slots/mappings/lala_voice'], ['get', '/api/v1/icon-slots/slot_1'],
  ['post', '/api/v1/icon-slots/mappings'], ['put', '/api/v1/icon-slots/mappings/lala_voice'], ['delete', '/api/v1/icon-slots/mappings/lala_voice'],
];

const BODY = {
  timestamp: 1, slot_id: 'slot_1', action: 'appear', asset_role: 'lala_voice', icon_type: 'voice', slot_category: 'ui',
  start_time: 0, end_time: 1, track_type: 'bgm', action_type: 'move', target_type: 'icon', scene_name: 'S1',
};

(shouldSkip ? describe.skip : describe)('legacy cue routes on the shared pool', () => {
  let token;
  const ep = crypto.randomUUID();
  const show = crypto.randomUUID();

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'legacy-pool-admin', email: 'admin@legacy.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await sequelize.query(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { replacements: { show, name: `Legacy ${show.slice(0, 8)}`, slug: `legacy-${show.slice(0, 8)}` } });
    await sequelize.query(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
                           VALUES (:ep, :show, 'Legacy ep', :n, 'draft', NOW(), NOW())`,
    { replacements: { ep, show, n: Math.floor(Math.random() * 100000) + 500 } });
    await sequelize.query(`INSERT INTO scenes (id, episode_id, scene_number, title, created_at, updated_at) VALUES (gen_random_uuid(), :ep, 1, 'S1', NOW(), NOW())`,
      { replacements: { ep } });
  });
  beforeEach(() => mockCreate.mockReset());
  afterEach(() => jest.restoreAllMocks());

  test('the legacy tables are absent here, as in production (this suite does not create them)', async () => {
    const [found] = await sequelize.query(`SELECT t FROM unnest(ARRAY[:tables]::text[]) t WHERE to_regclass('public.' || t) IS NOT NULL`,
      { replacements: { tables: LEGACY_TABLES } });
    expect(found).toEqual([]);
  });

  test('src/db queries run on the shared pool and reach the database', async () => {
    const shared = getPool();
    const spy = jest.spyOn(shared, 'query');
    const { rows } = await db.pool.query('SELECT current_database() AS name');
    expect(rows[0].name).toBe('episode_metadata_test');
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(db.query('SELECT * FROM music_cues')).rejects.toMatchObject({ code: '42P01' });
  });

  test('all 47 routes answer the missing table with a JSON error: no crash, no AI call, no S3 upload, nothing written', async () => {
    const shared = getPool();
    const spy = jest.spyOn(shared, 'query');
    const upload = jest.spyOn(productionPackageService, 'uploadToS3');
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const counts = async () => (await sequelize.query(
      `SELECT (SELECT COUNT(*) FROM episodes WHERE id = :ep) AS e, (SELECT COUNT(*) FROM scenes WHERE episode_id = :ep) AS s,
              (SELECT updated_at FROM episodes WHERE id = :ep) AS eu`, { replacements: { ep } }))[0][0];
    const before = await counts();

    const routes = ROUTES(ep, crypto.randomUUID());
    expect(routes).toHaveLength(47);
    const answers = [];
    for (const [method, path] of routes) {
      const res = await request(app)[method](path).set('Authorization', `Bearer ${token}`).send(BODY);
      answers.push([method, path.replace(ep, ':ep'), res.status, res.type]);
    }
    for (const [method, path, status, type] of answers) {
      expect({ route: `${method} ${path}`, server: status >= 400 && status < 600, json: type }).toEqual({ route: `${method} ${path}`, server: true, json: 'application/json' });
    }
    // Most answers are the missing table itself, 500 from the controller; a lookup that finds nothing is 404.
    expect(answers.filter(([, , s]) => s === 500).length).toBeGreaterThan(30);
    const missing = errors.mock.calls.map((c) => c.map((a) => (a && a.message) || String(a)).join(' ')).filter((m) => /relation "[a-z_]+" does not exist/.test(m));
    expect(missing.length).toBeGreaterThan(30);
    expect(errors.mock.calls.some((c) => c.some((a) => /pg_hba|no encryption|password authentication/.test((a && a.message) || String(a))))).toBe(false);

    expect(spy).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(await counts()).toEqual(before);

    const health = await request(app).get('/health');
    expect(health.status).toBeLessThan(500);
  });
});
