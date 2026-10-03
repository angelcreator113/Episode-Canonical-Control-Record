/**
 * GET /api/v1/scene-sets is scoped on the server (audit CTX-03,
 * 2026-10-03): two shows plus a shared set, and show A lists only its own
 * and the deliberately shared ones; scope narrows; limit applies; bad
 * requests say why. Through the real route on the migrated database.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { sceneSetListScope } = require('../../src/routes/sceneSetRoutes');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

describe('sceneSetListScope', () => {
  test('show_id alone is this show plus the shared ones; scope narrows; bad values are refused', () => {
    expect(sceneSetListScope({})).toMatchObject({ scope: 'all', where: {}, limit: null, offset: 0 });
    expect(sceneSetListScope({ show_id: 'a' })).toMatchObject({ scope: 'show+shared', showId: 'a' });
    expect(sceneSetListScope({ show_id: 'a', scope: 'show' })).toMatchObject({ scope: 'show', where: { show_id: 'a' } });
    expect(sceneSetListScope({ scope: 'shared' }).scope).toBe('shared');
    expect(sceneSetListScope({ show_id: 'a', scope: 'all' })).toMatchObject({ scope: 'all', where: {} });
    expect(sceneSetListScope({ scope: 'mine' }).error).toMatch(/scope must be one of/);
    expect(sceneSetListScope({ scope: 'show' }).error).toBe('scope=show needs show_id');
    expect(sceneSetListScope({ limit: '0' }).error).toMatch(/limit must be/);
    expect(sceneSetListScope({ limit: '2', offset: '3' })).toMatchObject({ limit: 2, offset: 3 });
    expect(sceneSetListScope({ offset: '-1' }).error).toMatch(/offset must be/);
  });
});

(shouldSkip ? describe.skip : describe)('GET /api/v1/scene-sets: scoped on the server (audit CTX-03)', () => {
  const showA = uuid();
  const showB = uuid();
  const ids = { a1: uuid(), b1: uuid(), shared: uuid(), franchise: uuid() };
  let token;
  const list = (qs = '') => request(app).get(`/api/v1/scene-sets${qs}`).set('Authorization', `Bearer ${token}`);
  const idsOf = (res) => res.body.data.map((s) => s.id);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-scene-scope', email: 'user@scenescope.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const [id, name] of [[showA, 'Scope show A'], [showB, 'Scope show B']]) {
      await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
        { id, name: `${name} ${id.slice(0, 8)}`, slug: `scope-${id.slice(0, 8)}` });
    }
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, is_franchise_asset, generation_status, created_at, updated_at) VALUES
      (:a1, 'A home', 'HOME_BASE', :showA, false, 'complete', NOW(), NOW()),
      (:b1, 'B home', 'HOME_BASE', :showB, false, 'complete', NOW(), NOW()),
      (:shared, 'Shared venue', 'EVENT_LOCATION', NULL, false, 'complete', NOW(), NOW()),
      (:franchise, 'B franchise venue', 'EVENT_LOCATION', :showB, true, 'complete', NOW(), NOW())`,
    { ...ids, showA, showB });
  });

  test('show A lists its own sets and the shared ones, never show B\'s', async () => {
    const res = await list(`?show_id=${showA}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, scope: 'show+shared', show_id: showA });
    const got = idsOf(res);
    expect(got).toEqual(expect.arrayContaining([ids.a1, ids.shared, ids.franchise]));
    expect(got).not.toContain(ids.b1);
    expect(res.body.counts.show).toBe(1);
    expect(res.body.counts.shared).toBeGreaterThanOrEqual(2);
    expect(res.body.counts.all).toBeGreaterThanOrEqual(4);
  });

  test('scope=show is this show only; scope=shared the shared ones only; no params is every set', async () => {
    const own = await list(`?show_id=${showA}&scope=show`);
    expect(own.body.scope).toBe('show');
    expect(idsOf(own)).toEqual([ids.a1]);

    const shared = await list('?scope=shared');
    expect(shared.body.scope).toBe('shared');
    expect(idsOf(shared)).toEqual(expect.arrayContaining([ids.shared, ids.franchise]));
    expect(idsOf(shared)).not.toContain(ids.a1);
    expect(idsOf(shared)).not.toContain(ids.b1);

    const all = await list();
    expect(all.body.scope).toBe('all');
    expect(all.body.counts).toBeUndefined();
    expect(idsOf(all)).toEqual(expect.arrayContaining([ids.a1, ids.b1, ids.shared, ids.franchise]));
  });

  test('limit and offset apply, with the total; bad values are refused', async () => {
    const page = await list(`?show_id=${showA}&limit=2`);
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(2);
    expect(page.body.total).toBeGreaterThanOrEqual(3);
    const next = await list(`?show_id=${showA}&limit=2&offset=2`);
    expect(next.body.data.length).toBeGreaterThanOrEqual(1);
    expect(idsOf(next)).not.toEqual(expect.arrayContaining(idsOf(page)));

    expect((await list('?scope=mine')).status).toBe(400);
    expect((await list('?scope=show')).status).toBe(400);
    expect((await list('?limit=0')).status).toBe(400);
    expect((await list('?limit=9999')).status).toBe(400);
  });
});
