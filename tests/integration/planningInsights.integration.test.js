/**
 * Season Arc build PR 8: Planning Insights (Evoni's rulings and answers,
 * 2026-10-01; docs/EVENT_EPISODE_FLOW.md §8(ff)).
 *   A8. "compares planned pressure with actual results per slot. Season
 *       money (spend, income, balance trend) comes from the ledger only,
 *       never from cost_coins."
 *   Q13. "per slot, with phase totals. The balance trend counts every
 *       ledger row, so deals and purchases between episodes show."
 *   Q15. "one line, using the slot outcome ranges instead of the fixed
 *       1/4/2/1 targets."
 * On the test database, through GET /world/:showId/season/insights.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const contextMigration = require('../../src/migrations/20261001240000-add-episode-season-context');
const threadsMigration = require('../../src/migrations/20261001250000-create-show-story-threads');
const { seedArc } = require('../../src/services/arcProgressionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Planning Insights (§8(ff) A8, Q13, Q15, PR 8)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const insightsOf = async (show) => auth(request(app).get(`/api/v1/world/${show}/season/insights`));

  async function seedShow({ arc = true } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Insights ${show.slice(0, 8)}`, slug: `insights-${show.slice(0, 8)}` });
    if (!arc) return { show };
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }

  let minute = 0;
  const ledger = (show, { episode = null, type, amount, category = 'misc', status = 'executed' }) => {
    minute += 1;
    return run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, created_at, updated_at)
                VALUES (:id, :show, :episode, :type, :category, :amount, :status, NOW() - make_interval(mins => 1000 - :minute), NOW())`,
    { id: uuid(), show, episode, type, category, amount, status, minute });
  };

  /** An accepted episode in a slot, with its plan and result. */
  async function acceptedIn(show, arcId, n, { desired = null, range = null, outcome = null, pressure = null }) {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, :title, :n, 'draft', NOW(), NOW())`, { ep, show, title: `Episode ${n}`, n });
    await run(`UPDATE season_slots SET episode_id = :ep, locked_at = NOW(), desired_pressure = :desired,
                      outcome_range = CAST(:range AS jsonb), actual_outcome = :outcome, actual_pressure = :pressure
                WHERE arc_id = :arcId AND slot_number = :n`,
    { ep, desired, range: range ? JSON.stringify(range) : null, outcome, pressure, arcId, n });
    return ep;
  }

  beforeAll(async () => {
    for (const m of [slotsMigration, contextMigration, threadsMigration]) await m.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-planning-insights', email: 'user@planning-insights.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const show of shows) {
      for (const table of ['financial_transactions', 'career_goals', 'season_slots', 'show_story_threads', 'show_arcs', 'world_events']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('per slot: planned pressure and range beside the actual result, and its money from the ledger (A8, Q13)', async () => {
    const { show, arcId } = await seedShow();
    await ledger(show, { type: 'income', amount: 1000, category: 'starting_balance' });
    const ep1 = await acceptedIn(show, arcId, 1, { desired: 'Medium', range: { min: 'pass', max: 'slay' }, outcome: 'pass', pressure: 'High' });
    await ledger(show, { episode: ep1, type: 'income', amount: 300, category: 'event_payment' });
    await ledger(show, { episode: ep1, type: 'expense', amount: 120, category: 'wardrobe_purchase' });
    await ledger(show, { episode: ep1, type: 'expense', amount: 999, category: 'event_cost', status: 'pending' }); // not counted
    await ledger(show, { type: 'expense', amount: 50, category: 'wardrobe_purchase' }); // between episodes
    // An event with a cost_coins the ledger never charged: not in the money (A8).
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, cost_coins, used_in_episode_id, created_at, updated_at)
               VALUES (:id, :show, 'Costly Gala', 'invite', 'used', 777, :ep1, NOW(), NOW())`, { id: uuid(), show, ep1 });
    await run("UPDATE season_slots SET desired_pressure = 'Low', story_purpose = 'Rest' WHERE arc_id = :arcId AND slot_number = 4", { arcId });

    const res = await insightsOf(show);

    expect(res.status).toBe(200);
    const phase1 = res.body.insights.phases[0];
    expect(phase1.slots.map((s) => s.label)).toEqual(['S1 · E1', 'S1 · E4']);
    expect(phase1.unplanned_count).toBe(6);
    const [one, four] = phase1.slots;
    expect(one).toEqual(expect.objectContaining({
      planned: expect.objectContaining({ desired_pressure: 'Medium', outcome_range: { min: 'pass', max: 'slay' } }),
      actual: { outcome: 'pass', pressure: 'High' },
      pressure_delta: 1,
      outcome_in_range: true,
      money: { income: 300, spend: 120, net: 180 },
    }));
    expect(four).toEqual(expect.objectContaining({ episode: null, money: null, pressure_delta: null, outcome_in_range: null }));
    expect(phase1.totals).toEqual({ income: 300, spend: 120, net: 180 });
    expect(res.body.insights.money.season).toEqual({ income: 300, spend: 120, net: 180 });
  });

  test('the balance trend counts every ledger row, between episodes too, and ends at Lala\'s balance (Q13)', async () => {
    const { show, arcId } = await seedShow();
    await ledger(show, { type: 'income', amount: 1000, category: 'starting_balance' });
    const ep1 = await acceptedIn(show, arcId, 1, { outcome: 'safe', pressure: 'Low' });
    await ledger(show, { episode: ep1, type: 'expense', amount: 200, category: 'event_cost' });
    await ledger(show, { type: 'income', amount: 400, category: 'brand_deal' }); // a deal between episodes

    const { trend, balance } = (await insightsOf(show)).body.insights.money;

    expect(trend.map((t) => [t.amount, t.balance_after, t.slot_label, t.between_episodes])).toEqual([
      [1000, 1000, null, true],
      [-200, 800, 'S1 · E1', false],
      [400, 1200, null, true],
    ]);
    expect(balance).toBe(1200);
    const { getCurrentBalance } = require('../../src/services/financialTransactionService');
    expect(await getCurrentBalance(sequelize, show)).toBe(1200);
  });

  test('season health is how many accepted episodes landed in their planned range (Q15)', async () => {
    const { show, arcId } = await seedShow();
    await acceptedIn(show, arcId, 1, { range: { min: 'pass', max: 'slay' }, outcome: 'slay' });
    await acceptedIn(show, arcId, 2, { range: { min: 'pass', max: 'slay' }, outcome: 'fail' });
    await acceptedIn(show, arcId, 3, { outcome: 'safe' }); // no range planned

    const { health, phases } = (await insightsOf(show)).body.insights;

    expect(health).toEqual({ accepted: 3, with_range: 2, in_range: 1, without_range: 1 });
    expect(phases[0].slots.map((s) => s.outcome_in_range)).toEqual([true, false, null]);
  });

  test('a show with no active season has no insights', async () => {
    const { show } = await seedShow({ arc: false });
    const res = await insightsOf(show);
    expect(res.status).toBe(200);
    expect(res.body.insights).toBeNull();
  });
});
