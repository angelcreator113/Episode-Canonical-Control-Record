/**
 * GET /world/:showId/history returns the newest 50 rows by default. The
 * State tab's "after each episode" needs every episode's 'computed' rows,
 * so a season of wardrobe purchases pushed the earliest episodes out
 * (wiring map, docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list
 * item 14). ?source= narrows to one kind of row; ?limit= is bounded.
 */
jest.unmock('uuid');

const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('GET /world/:showId/history ?source and ?limit', () => {
  let token;
  let show;
  let episode;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-history', email: 'test@history.dev', name: 'History Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    [{ id: show }] = await q('SELECT gen_random_uuid() AS id');
    [{ id: episode }] = await q('SELECT gen_random_uuid() AS id');
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'History Test', :slug, NOW(), NOW())`,
      { show, slug: `history-test-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, created_at, updated_at)
               VALUES (:episode, :show, 'The First Episode', 1, NOW(), NOW())`, { episode, show });
    // The episode's computed row is the oldest; 60 purchases come after it.
    await run(`INSERT INTO character_state_history (id, show_id, character_key, episode_id, source, deltas_json, created_at)
               VALUES (gen_random_uuid(), :show, 'lala', :episode, 'computed', '{"reputation":3}'::jsonb, NOW() - INTERVAL '30 days')`,
    { show, episode });
    await run(`INSERT INTO character_state_history (id, show_id, character_key, source, deltas_json, created_at)
               SELECT gen_random_uuid(), :show, 'lala', 'wardrobe_purchase', '{"coins":-10}'::jsonb, NOW() - (g || ' minutes')::interval
               FROM generate_series(1, 60) g`, { show });
  });

  afterAll(async () => {
    await run('DELETE FROM character_state_history WHERE show_id = :show', { show });
    await run('DELETE FROM episodes WHERE show_id = :show', { show });
    await run('DELETE FROM shows WHERE id = :show', { show });
  });

  const get = (qs = '') => request(app).get(`/api/v1/world/${show}/history${qs}`).set('Authorization', `Bearer ${token}`);

  it('the newest 50 by default leave the episode out', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(50);
    expect(res.body.history.some((h) => h.source === 'computed')).toBe(false);
  });

  it('?source=computed returns the episode row, with its number', async () => {
    const res = await get('?source=computed&limit=1000');
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0]).toMatchObject({ source: 'computed', episode_id: episode, episode_number: 1 });
  });

  it('a source the ledger does not have is a 400, not a database error', async () => {
    const res = await get('?source=purchases');
    expect(res.status).toBe(400);
  });

  it('?limit is bounded and a non-number falls back to 50', async () => {
    expect((await get('?limit=abc')).body.history).toHaveLength(50);
    expect((await get('?limit=0')).body.history).toHaveLength(1);
    expect((await get('?limit=5000')).body.history).toHaveLength(61);
  });
});
