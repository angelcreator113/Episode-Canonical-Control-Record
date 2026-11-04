/**
 * Advancing an opportunity writes no career goal progress, on the test
 * database. Advance used to add the opportunity's payment_amount to coins
 * goals and guessed bumps to reputation / brand_trust / influence goals,
 * writing career_goals.current_value with no ledger row and no
 * character_state change; completed → paid added the payment twice. Goals
 * move only from the ledger and character_state (completeEpisode step 17,
 * POST /goals/sync).
 *   POST /api/v1/opportunities/:showId/:id/advance   active → completed → paid
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
const TAG = uuid().slice(0, 8);
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Opportunity Advance writes no career goal progress', () => {
  const show = uuid();
  const opp = uuid();
  const goals = { coins: uuid(), reputation: uuid(), brand_trust: uuid(), influence: uuid() };
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    // Advance is ADMIN only.
    token = TokenService.generateTokenPair({ id: 'test-admin-advgoal', email: 'admin@advgoal.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Advance goals ${TAG}`, slug: `advance-goals-${TAG}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 300, 3, 1, 2, 2, NOW(), NOW())`, { id: uuid(), show });
    // Coins 9800 of 10000: the old +500 would have completed it and spawned its unlock.
    const seed = [
      [goals.coins, 'Save 10k', 'coins', 9800, 10000, JSON.stringify(['Next deal'])],
      [goals.reputation, 'Reputation 10', 'reputation', 9, 10, '[]'],
      [goals.brand_trust, 'Brand trust 10', 'brand_trust', 1, 10, '[]'],
      [goals.influence, 'Influence 10', 'influence', 2, 10, '[]'],
    ];
    for (const [id, title, metric, current, target, unlocks] of seed) {
      await run(`INSERT INTO career_goals (id, show_id, title, type, target_metric, current_value, target_value, starting_value, status, priority, unlocks_on_complete, created_at, updated_at)
                 VALUES (:id, :show, :title, 'secondary', :metric, :current, :target, 0, 'active', 2, CAST(:unlocks AS jsonb), NOW(), NOW())`,
        { id, show, title, metric, current, target, unlocks });
    }
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, status_history, prestige, payment_amount, created_at, updated_at)
               VALUES (:opp, :show, 'Maison Belle campaign', 'brand_deal', 'active', CAST('[]' AS jsonb), 7, 500, NOW(), NOW())`, { opp, show });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const table of ['financial_transactions', 'opportunities', 'career_goals', 'character_state']) {
      await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch((err) => console.error('cleanup', table, err.message));
    }
    await run('DELETE FROM shows WHERE id = :show', { show }).catch((err) => console.error('cleanup shows', err.message));
    await sequelize.close();
  });

  const goalValues = async () => (await rows(
    `SELECT target_metric, current_value::float AS v, status FROM career_goals WHERE show_id = :show ORDER BY target_metric`, { show }));

  test('active → completed → paid leaves every goal, the ledger and character_state unchanged', async () => {
    const before = await goalValues();
    const stateBefore = await rows('SELECT coins, reputation, brand_trust, influence FROM character_state WHERE show_id = :show', { show });

    for (const to of ['completed', 'paid']) {
      const res = await auth(request(app).post(`/api/v1/opportunities/${show}/${opp}/advance`)).send({ to_status: to });
      expect(res.status).toBe(200);
      expect(res.body.opportunity.status).toBe(to);
      expect(res.body.pipeline).toEqual(expect.objectContaining({ goals_updated: [], goals_completed: [], unlocks: [] }));
    }

    expect(await goalValues()).toEqual(before);
    expect(before.map((g) => [g.target_metric, g.v, g.status])).toEqual([
      ['brand_trust', 1, 'active'], ['coins', 9800, 'active'], ['influence', 2, 'active'], ['reputation', 9, 'active'],
    ]);
    expect(await rows('SELECT id FROM financial_transactions WHERE show_id = :show', { show })).toEqual([]);
    expect(await rows('SELECT coins, reputation, brand_trust, influence FROM character_state WHERE show_id = :show', { show })).toEqual(stateBefore);
    // No unlock spawned from the coins goal.
    expect((await rows('SELECT id FROM opportunities WHERE show_id = :show', { show })).map((r) => r.id)).toEqual([opp]);
  });
});
