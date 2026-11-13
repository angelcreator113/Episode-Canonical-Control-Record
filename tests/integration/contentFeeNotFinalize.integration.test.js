/**
 * A deliverable's content fee does not, by itself, make its episode count as
 * finalized (Evoni, 2026-11-13).
 *
 * The fee is booked when the deliverable is approved, which can come before
 * Finalize, and its ledger row carries the episode. Finalize's "already
 * finalized" check counted every such row, so after an approval Finalize (and
 * the Finalize inside Complete) booked none of its own rows: the episode's
 * costs were never charged. The check now leaves content_fee out. Nothing
 * else moves: the fee is still booked once, Finalize still books once, and a
 * content fee is still booked money to the terms reopen.
 *
 * Twins are identical shows taken through the two orders; the ledger, Lala's
 * coins and what the episode stores must not depend on the order.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { finalizeEpisodeFinancials, getCurrentBalance } = require('../../src/services/financialTransactionService');
const { reopenEligibility, REOPEN_REASONS } = require('../../src/services/termsReopenService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

const FEE = 120;   // the deliverable's content fee
const COST = 80;   // the event cost Lala pays, which Finalize books

(shouldSkip ? describe.skip : describe)('a content fee is not a finalize', () => {
  const shows = [];
  let admin;
  let n = 0;

  beforeAll(() => {
    // Approving books the fee, so it is an admin's.
    admin = TokenService.generateTokenPair({ id: 'test-admin-fee-finalize', email: 'admin@fee-finalize.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  });
  beforeEach(() => {
    n += 1;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const del = (sql) => sequelize.query(sql, { replacements: { shows } }).catch(() => {});
    if (shows.length) {
      for (const t of ['financial_transactions', 'character_state_history', 'character_state']) await del(`DELETE FROM ${t} WHERE show_id IN (:shows)`);
      await del('DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id IN (:shows))');
      await del('DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id IN (:shows))');
      await del('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id IN (:shows)');
      await del('DELETE FROM episodes WHERE show_id IN (:shows)');
      await del('DELETE FROM world_events WHERE show_id IN (:shows)');
      await del('DELETE FROM shows WHERE id IN (:shows)');
    }
    await sequelize.close();
  });

  /**
   * A show starting at 1000 coins; a draft episode started from a deal that
   * pays its deliverables; one cost of 80 Lala pays (Finalize's own row); one
   * submitted deliverable with a fee of 120 (the content fee, on approval).
   */
  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), deliverable: uuid(), cost: uuid(), state: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :name, CAST(:meta AS jsonb), NOW(), NOW())`,
      { ...ids, name: `fee-fin-${ids.show.slice(0, 8)}`, meta: JSON.stringify({ starting_balance: 1000 }) });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, event_type, deal_type, status, prestige, cost_coins, used_in_episode_id, is_paid, payment_amount, host_brand, created_at, updated_at)
               VALUES (:event, :show, 'Velvet Gala', 'invite', 'paid_deliverables', 'used', 5, 0, :ep, false, 0, 'Maison Belle', NOW(), NOW())`, ids);
    await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at) VALUES (:cost, :event, 'travel', 'Car to the gala', :amount, 'lala', NOW(), NOW())`,
      { ...ids, amount: COST });
    await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, required, owed_to, fee, status, episode_id, created_at, updated_at)
               VALUES (:deliverable, :event, 'One reel in the coat', 'reel', true, 'brand', :fee, 'submitted', :ep, NOW(), NOW())`, { ...ids, fee: FEE });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:state, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, ids);
    return ids;
  }

  const approve = (ids) => request(app)
    .post(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${ids.deliverable}/status`)
    .set('X-Forwarded-For', `10.75.${Math.floor(n / 250)}.${(n % 250) + 1}`)
    .set('Authorization', `Bearer ${admin}`)
    .send({ status: 'approved' });
  const finalize = (ids) => finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
  const complete = (ids) => completeEpisode(ids.ep, ids.show, sequelize);

  const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  const ledger = (ids) => q(
    `SELECT category, type, amount::float AS amount FROM financial_transactions
      WHERE show_id = :show AND status = 'executed' AND deleted_at IS NULL ORDER BY category, amount`, ids);
  const of = (rows, category) => rows.filter((r) => r.category === category);
  const coins = async (ids) => (await q(`SELECT coins FROM character_state WHERE id = :state`, ids))[0].coins;
  /** Where the money ended up and what the episode stores about it. */
  async function end(ids) {
    const [ep] = await q(`SELECT evaluation_status, total_income::float AS total_income, total_expenses::float AS total_expenses, financial_score, evaluation_json FROM episodes WHERE id = :ep`, ids);
    return {
      ledger: await ledger(ids),
      coins: await coins(ids),
      balance: await getCurrentBalance(sequelize, ids.show),
      status: ep.evaluation_status,
      total_income: ep.total_income,
      total_expenses: ep.total_expenses,
      financial_score: ep.financial_score,
      financial_summary: (asJson(ep.evaluation_json) || {}).financial_summary,
    };
  }
  const BOTH = [
    { category: 'content_fee', type: 'income', amount: FEE },
    { category: 'event_cost', type: 'expense', amount: COST },
    { category: 'seed', type: 'income', amount: 1000 },
  ];

  test('1. approve, then Finalize: Finalize books its own rows, as it does when it runs first', async () => {
    const first = await seed();
    expect((await approve(first)).status).toBe(200);
    const result = await finalize(first);
    expect(result.already_finalized).toBeUndefined();
    expect(result.transactions.map((t) => t.category)).toEqual(['event_cost']);

    const twin = await seed();
    await finalize(twin);
    expect((await approve(twin)).status).toBe(200);

    const a = await end(first);
    const b = await end(twin);
    expect(a.ledger).toEqual(BOTH);
    expect(a).toEqual(b);
    expect(a.coins).toBe(1000 + FEE - COST);
    expect(a.coins).toBe(a.balance);
    // The episode's own totals are Finalize's rows; the fee is the deal's income, not Finalize's.
    expect(a.total_expenses).toBe(COST);
    expect(a.total_income).toBe(0);
  });

  test('2. approve, then Complete directly: the same ledger, coins and stored totals as Complete, then approve', async () => {
    const first = await seed();
    expect((await approve(first)).status).toBe(200);
    await complete(first);

    const twin = await seed();
    await complete(twin);
    expect((await approve(twin)).status).toBe(200);

    const a = await end(first);
    const b = await end(twin);
    expect(a.status).toBe('accepted');
    expect(a.ledger).toEqual(BOTH);
    expect(a).toEqual(b);
    expect(a.coins).toBe(1000 + FEE - COST);
    expect(a.total_expenses).toBe(COST);
    expect(a.financial_summary).toMatchObject({ total_income: 0, total_expenses: COST, net_profit: -COST });
  });

  test('3. approve, Finalize, Finalize again: the second books nothing', async () => {
    const ids = await seed();
    expect((await approve(ids)).status).toBe(200);
    await finalize(ids);
    const once = await end(ids);
    const again = await finalize(ids);
    expect(again.already_finalized).toBe(true);
    expect(await end(ids)).toEqual(once);
    expect(of(once.ledger, 'event_cost')).toHaveLength(1);
  });

  test('4. approve twice: one content fee', async () => {
    const ids = await seed();
    expect((await approve(ids)).status).toBe(200);
    const once = await end(ids);
    expect((await approve(ids)).status).toBe(400);
    expect(await end(ids)).toEqual(once);
    expect(of(once.ledger, 'content_fee')).toEqual([{ category: 'content_fee', type: 'income', amount: FEE }]);
    expect(once.coins).toBe(1000 + FEE);
  });

  test('5. approve and Finalize at once: each books once', async () => {
    const ids = await seed();
    const [approved, finalized] = await Promise.all([approve(ids), finalize(ids)]);
    expect(approved.status).toBe(200);
    expect(finalized.already_finalized).toBeUndefined();
    const after = await end(ids);
    expect(after.ledger).toEqual(BOTH);
    expect(after.coins).toBe(1000 + FEE - COST);
    expect(after.coins).toBe(after.balance);
  });

  test('6. a content fee is still booked money to the terms reopen', async () => {
    const ids = await seed();
    const before = await reopenEligibility(sequelize, ids.event);
    expect(before.reasons.map((r) => r.code)).not.toContain(REOPEN_REASONS.LEDGER_ROWS);
    expect((await approve(ids)).status).toBe(200);
    const after = await reopenEligibility(sequelize, ids.event);
    expect(after.eligible).toBe(false);
    expect(after.reasons.map((r) => r.code)).toContain(REOPEN_REASONS.LEDGER_ROWS);
  });

  test('7. a content fee and reopened terms: Finalize is still refused, and books nothing', async () => {
    const ids = await seed();
    expect((await approve(ids)).status).toBe(200);
    await run(`UPDATE world_events SET canon_consequences = CAST(:cc AS jsonb) WHERE id = :event`,
      { ...ids, cc: JSON.stringify({ terms_reopen: { at: '2026-11-13T00:00:00.000Z', by: { id: 'test-admin-fee-finalize', name: 'Admin' } } }) });
    const before = await end(ids);
    await expect(finalize(ids)).rejects.toMatchObject({ name: 'TermsReopenedError', status: 409 });
    expect(await end(ids)).toEqual(before);
    expect(of(before.ledger, 'event_cost')).toEqual([]);
  });

  test('8. with no content fee, Finalize is as it was: books once, then reports already finalized', async () => {
    const ids = await seed();
    const first = await finalize(ids);
    expect(first.transactions.map((t) => t.category)).toEqual(['event_cost']);
    const once = await end(ids);
    expect((await finalize(ids)).already_finalized).toBe(true);
    expect(await end(ids)).toEqual(once);
    expect(once.ledger).toEqual([{ category: 'event_cost', type: 'expense', amount: COST }, { category: 'seed', type: 'income', amount: 1000 }]);
    expect(once.coins).toBe(1000 - COST);
  });
});
