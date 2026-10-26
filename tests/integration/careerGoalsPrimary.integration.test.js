/**
 * One primary goal (Evoni, 2026-10-25: "Primary Goal (1 max)" showed five),
 * and goal ladders on Sync from stats, on the test database:
 *   POST /api/v1/world/:showId/goals            a second primary is 409
 *   PUT  /api/v1/world/:showId/goals/:goalId    becoming primary is 409; swap_primary swaps
 *   POST /api/v1/world/:showId/goals/sync       completes a rung, names the next one; a stat
 *                                               to keep under never completes; idempotent
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');
const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('One primary goal, and ladders on sync (Evoni, 2026-10-25)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  async function seedShow(state = { coins: 294, stress: 2 }) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Primary ${show.slice(0, 8)}`, slug: `primary-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', :coins, 0, 0, 2, :stress, NOW(), NOW())`, { id: uuid(), show, ...state });
    return show;
  }
  async function goal(show, f) {
    const id = uuid();
    await run(`INSERT INTO career_goals (id, show_id, title, type, target_metric, current_value, target_value, starting_value, status, priority, created_at, updated_at)
               VALUES (:id, :show, :title, :type, :metric, :current, :target, 0, 'active', :priority, NOW(), NOW())`,
      { id, show, type: 'secondary', current: 0, priority: 2, ...f });
    return id;
  }
  const statusOf = async (id) => (await rows('SELECT type, status FROM career_goals WHERE id = :id', { id }))[0];

  beforeAll(() => {
    token = TokenService.generateTokenPair({ id: 'test-user-primary', email: 'user@primary.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  afterAll(async () => {
    for (const show of shows) {
      for (const table of ['character_state', 'career_goals']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch((err) => console.error('cleanup', table, err.message));
      }
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('a second primary is refused with 409 naming the first; Make primary swaps them', async () => {
    const show = await seedShow();
    const legacy = await goal(show, { title: 'Legacy', type: 'primary', metric: 'reputation', target: 10, priority: 1 });
    const maison = await goal(show, { title: 'The Maison Belle Contract', metric: 'brand_trust', target: 8 });

    const created = await auth(request(app).post(`/api/v1/world/${show}/goals`)).send({ title: 'Luxury Access', type: 'primary', target_metric: 'reputation', target_value: 7 });
    expect(created.status).toBe(409);
    expect(created.body).toEqual(expect.objectContaining({ code: 'PRIMARY_TAKEN', primary_goal: expect.objectContaining({ id: legacy, title: 'Legacy' }) }));
    expect(created.body.error).toBe('"Legacy" is already the primary goal. Make it secondary first, or use Make primary to swap.');

    const put = await auth(request(app).put(`/api/v1/world/${show}/goals/${maison}`)).send({ type: 'primary' });
    expect(put.status).toBe(409);
    expect((await statusOf(maison)).type).toBe('secondary');
    // Editing the primary itself (keeping it primary) is fine.
    expect((await auth(request(app).put(`/api/v1/world/${show}/goals/${legacy}`)).send({ type: 'primary', title: 'Legacy' })).status).toBe(200);

    const swap = await auth(request(app).put(`/api/v1/world/${show}/goals/${maison}`)).send({ type: 'primary', swap_primary: true });
    expect(swap.status).toBe(200);
    expect((await statusOf(maison)).type).toBe('primary');
    expect((await statusOf(legacy)).type).toBe('secondary');
    expect((await auth(request(app).put(`/api/v1/world/${show}/goals/${uuid()}`)).send({ title: 'x' })).status).toBe(404);
  });

  test('sync completes a rung and names the next one; stress that rose does not complete; a second sync is a no-op', async () => {
    const show = await seedShow({ coins: 600, stress: 6 });
    const starter = await goal(show, { title: 'Starter Fund', metric: 'coins', target: 500, current: 294 });
    const money = await goal(show, { title: 'The Money Talk', metric: 'coins', target: 2000, current: 294 });
    // Stress rose from 2 to 6: the old >= rule completed this; reduce-to does not.
    const pressure = await goal(show, { title: 'The Pressure of Influence', metric: 'stress', target: 4, current: 2 });
    const first = await auth(request(app).post(`/api/v1/world/${show}/goals/sync`));
    expect(first.status).toBe(200);
    expect(first.body.completed.map((c) => c.id)).toEqual([starter]);
    expect(first.body.activated).toEqual([expect.objectContaining({ id: money, title: 'The Money Talk' })]);
    expect((await statusOf(pressure)).status).toBe('active');
    expect((await statusOf(money)).status).toBe('active');
    const second = await auth(request(app).post(`/api/v1/world/${show}/goals/sync`));
    expect(second.body).toEqual(expect.objectContaining({ synced: 0, completed: [], activated: [] }));
  });

  test('sync: stress at or below its target completes; a passive goal is measured but never completed (as on episode completion)', async () => {
    const show = await seedShow({ coins: 9000, stress: 3 });
    const atTarget = await goal(show, { title: 'Ease off', metric: 'stress', target: 3, current: 7 });
    const below = await goal(show, { title: 'The Pressure of Influence', metric: 'stress', target: 4, current: 7 });
    const passive = await goal(show, { title: 'Manage Stress', type: 'passive', metric: 'stress', target: 3, current: 7 });
    const floor = await goal(show, { title: 'Never below 100', type: 'passive', metric: 'coins', target: 100, current: 50 });
    const res = await auth(request(app).post(`/api/v1/world/${show}/goals/sync`));
    expect(res.status).toBe(200);
    expect(res.body.completed.map((c) => c.id).sort()).toEqual([atTarget, below].sort());
    expect((await statusOf(passive)).status).toBe('active');
    expect((await statusOf(floor)).status).toBe('active');
    const values = await rows('SELECT id, current_value FROM career_goals WHERE id IN (:ids)', { ids: [passive, floor] });
    expect(Object.fromEntries(values.map((r) => [r.id, Number(r.current_value)]))).toEqual({ [passive]: 3, [floor]: 9000 });
  });
});
