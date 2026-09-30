/**
 * Deal payouts (deal build PR 5; docs/DEAL_DESIGN.md §4, §11.2, §10.3).
 *
 * Through Complete, the deliverable status route and the migration:
 *   - a deal is paid each component it carries at Complete, each under its
 *     own ledger name (Evoni's answer 1, 2026-09-30), and a deal_bonus only
 *     for the tier its accepted terms name (Q12);
 *   - a no-cash deal is paid nothing;
 *   - the generic tier reward, paid bonus and event reward are retired for
 *     every completion, legacy events included; a legacy event keeps its
 *     payment and content revenue;
 *   - a deliverable's content fee is paid once, on approval;
 *   - the payout index migration covers the five categories and reruns.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { bookContentFee } = require('../../src/services/dealPayoutService');
const migration = require('../../src/migrations/20260930160000-extend-ledger-deal-payout-unique');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

const RETIRED = ['tier_reward', 'tier_paid_bonus', 'event_reward'];

(shouldSkip ? describe.skip : describe)('Deal payouts (deal build PR 5)', () => {
  let token;
  const shows = [];

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-payouts', email: 'test@payouts.dev', name: 'Payouts Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await migration.up(sequelize.getQueryInterface());
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state_history WHERE show_id = :show`, { show }).catch((err) => console.error('cleanup history:', err.message));
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  // A draft episode started from the event, and Lala with 1000 coins.
  async function seed(event) {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), state: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Payouts ${ids.show.slice(0, 8)}`, slug: `payouts-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Payout episode', 1, 'draft', NOW(), NOW())`, ids);
    const e = {
      deal_type: null, event_type: 'invite', cost_coins: 0, is_paid: false, payment_amount: 0,
      appearance_fee: null, partnership_base_fee: null, performance_fee: null, appearance_required: false,
      bonus_terms: null, rewards: null, host: 'Nia Vale', host_brand: null, ...event,
    };
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, event_type, deal_type, cost_coins,
                 is_paid, payment_amount, appearance_fee, partnership_base_fee, performance_fee, appearance_required,
                 bonus_terms, rewards, host, host_brand, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Velour Night', 'used', :ep, :event_type, :deal_type, :cost_coins,
                 :is_paid, :payment_amount, :appearance_fee, :partnership_base_fee, :performance_fee, :appearance_required,
                 :bonus_terms, :rewards, :host, :host_brand, 5, NOW(), NOW())`,
    { ...ids, ...e, bonus_terms: e.bonus_terms ? JSON.stringify(e.bonus_terms) : null, rewards: e.rewards ? JSON.stringify(e.rewards) : null });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:state, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, ids);
    return ids;
  }

  const ledger = (ids) => q(
    `SELECT category, amount::float AS amount, source_type, source_id, metadata FROM financial_transactions
      WHERE show_id = :show AND episode_id = :ep AND deleted_at IS NULL ORDER BY category`, ids);
  const tierOf = async (ids) => {
    const [ep] = await q(`SELECT evaluation_json FROM episodes WHERE id = :ep`, ids);
    return asJson(ep.evaluation_json)?.tier_final;
  };
  const categories = (rows) => rows.map((r) => r.category);

  const ALL_TIERS_BONUS = { slay: 300, pass: 200, safe: 100 };

  it('a paid appearance is paid its appearance fee at Complete, and its bonus for the tier reached', async () => {
    const ids = await seed({
      deal_type: 'paid_appearance', appearance_fee: 450, bonus_terms: ALL_TIERS_BONUS,
      // A legacy payment and a coin reward on a deal pay nothing now.
      is_paid: true, payment_amount: 300, rewards: { coins: 100 },
    });
    await completeEpisode(ids.ep, ids.show, sequelize);
    const rows = await ledger(ids);
    const tier = await tierOf(ids);

    const appearance = rows.filter((r) => r.category === 'appearance_fee');
    expect(appearance).toHaveLength(1);
    expect(appearance[0]).toMatchObject({ amount: 450, source_type: 'event', source_id: ids.event });
    expect(asJson(appearance[0].metadata)).toMatchObject({ component: 'appearance', payer: 'host', payer_name: 'Nia Vale' });

    const bonus = rows.filter((r) => r.category === 'deal_bonus');
    if (tier === 'fail') expect(bonus).toEqual([]);
    else expect(bonus.map((r) => r.amount)).toEqual([ALL_TIERS_BONUS[tier]]);

    for (const retired of [...RETIRED, 'event_payment', 'content_revenue']) {
      expect(categories(rows)).not.toContain(retired);
    }
  });

  it('a brand partnership is paid its base and, when required, its appearance, each under its own name; no bonus without terms', async () => {
    const ids = await seed({
      deal_type: 'brand_partnership', partnership_base_fee: 500, appearance_required: true, appearance_fee: 250,
      host_brand: 'Maison Belle',
    });
    await completeEpisode(ids.ep, ids.show, sequelize);
    const rows = await ledger(ids);
    expect(rows.filter((r) => ['appearance_fee', 'partnership_base_fee'].includes(r.category)).map((r) => [r.category, r.amount]))
      .toEqual([['appearance_fee', 250], ['partnership_base_fee', 500]]);
    const base = rows.find((r) => r.category === 'partnership_base_fee');
    expect(asJson(base.metadata)).toMatchObject({ payer: 'brand', payer_name: 'Maison Belle' });
    expect(categories(rows)).not.toContain('deal_bonus');
  });

  it('a performance booking is paid its performance fee', async () => {
    const ids = await seed({ deal_type: 'performance_booking', performance_fee: 400 });
    await completeEpisode(ids.ep, ids.show, sequelize);
    expect((await ledger(ids)).filter((r) => r.category === 'performance_fee').map((r) => r.amount)).toEqual([400]);
  });

  it('a no-cash deal is paid nothing, even with a fee or bonus stored', async () => {
    const ids = await seed({ deal_type: 'self_funded', appearance_fee: 999, bonus_terms: ALL_TIERS_BONUS });
    await completeEpisode(ids.ep, ids.show, sequelize);
    const rows = await ledger(ids);
    for (const c of ['appearance_fee', 'partnership_base_fee', 'performance_fee', 'deal_bonus', ...RETIRED]) {
      expect(categories(rows)).not.toContain(c);
    }
  });

  it('a legacy event keeps its payment and content revenue, and gets no tier reward, paid bonus or event reward', async () => {
    const ids = await seed({ event_type: 'brand_deal', is_paid: true, payment_amount: 300, cost_coins: 100, rewards: { coins: 100 } });
    await completeEpisode(ids.ep, ids.show, sequelize);
    const rows = await ledger(ids);
    expect(rows.filter((r) => ['event_payment', 'content_revenue'].includes(r.category)).map((r) => [r.category, r.amount]))
      .toEqual([['content_revenue', 30], ['event_payment', 300]]);
    for (const retired of RETIRED) expect(categories(rows)).not.toContain(retired);
  });

  it('a deliverable\'s content fee is paid once, on approval, and the coins follow the ledger', async () => {
    const ids = await seed({ deal_type: 'paid_deliverables', host_brand: 'Maison Belle' });
    const [d] = await q(
      `INSERT INTO event_deliverables (id, event_id, description, deliverable_type, required, owed_to, fee, status, episode_id, created_at, updated_at)
       VALUES (:id, :event, 'One reel in the coat', 'reel', true, 'brand', 120, 'pending', :ep, NOW(), NOW())
       RETURNING id`, { id: uuid(), ...ids });
    const advance = (status) => auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${d.id}/status`)).send({ status });

    for (const status of ['completed', 'submitted']) {
      expect((await advance(status)).status).toBe(200);
      expect((await ledger(ids)).filter((r) => r.category === 'content_fee')).toEqual([]);
    }
    const approved = await advance('approved');
    expect(approved.status).toBe(200);
    expect(approved.body.content_fee).toMatchObject({ category: 'content_fee', amount: 120 });

    const fees = (await ledger(ids)).filter((r) => r.category === 'content_fee');
    expect(fees).toHaveLength(1);
    expect(fees[0]).toMatchObject({ amount: 120, source_type: 'deliverable', source_id: d.id });
    expect(asJson(fees[0].metadata)).toMatchObject({ owed_to: 'brand', payer: 'brand', payer_name: 'Maison Belle' });

    // A second booking for the same deliverable pays nothing.
    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    const [row] = await q(`SELECT * FROM event_deliverables WHERE id = :id`, { id: d.id });
    const again = await sequelize.transaction((transaction) => bookContentFee(sequelize, { showId: ids.show, event, deliverable: row, transaction }));
    expect(again).toBeNull();
    expect((await ledger(ids)).filter((r) => r.category === 'content_fee')).toHaveLength(1);

    const [state] = await q(`SELECT coins FROM character_state WHERE id = :state`, ids);
    const [{ balance }] = await q(
      `SELECT COALESCE(SUM(CASE WHEN type IN ('income','reward') THEN amount ELSE -amount END), 0)::float AS balance
         FROM financial_transactions WHERE show_id = :show AND status = 'executed' AND deleted_at IS NULL`, ids);
    expect(Number(state.coins)).toBe(balance);
  });

  it('a deliverable of a deal that does not pay deliverables is approved with no fee', async () => {
    const ids = await seed({ deal_type: 'paid_appearance', appearance_fee: 100 });
    const [d] = await q(
      `INSERT INTO event_deliverables (id, event_id, description, required, owed_to, fee, status, episode_id, created_at, updated_at)
       VALUES (:id, :event, 'A story', true, 'host', 50, 'submitted', :ep, NOW(), NOW()) RETURNING id`, { id: uuid(), ...ids });
    const res = await auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${d.id}/status`)).send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.content_fee).toBeNull();
  });

  it('the event PUT validates bonus_terms and stores it', async () => {
    const ids = await seed({ deal_type: 'paid_appearance' });
    await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE id = :event`, ids);
    const put = (body) => auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}`)).send(body);
    expect((await put({ bonus_terms: { platinum: 5 } })).status).toBe(400);
    expect((await put({ bonus_terms: { slay: 0 } })).status).toBe(400);
    expect((await put({ bonus_terms: { slay: 250, pass: '' } })).status).toBe(200);
    const [row] = await q(`SELECT bonus_terms FROM world_events WHERE id = :event`, ids);
    expect(asJson(row.bonus_terms)).toEqual({ slay: 250 });
  });

  it('the migration rebuilds PR 1\'s index for the five payout categories, reruns as a no-op, and rolls back', async () => {
    const qi = sequelize.getQueryInterface();
    const pr1 = require('../../src/migrations/20260929200004-add-ledger-deal-payout-unique');
    const indexes = () => q(`SELECT indexname, indexdef FROM pg_indexes
                              WHERE tablename = 'financial_transactions' AND indexname LIKE 'financial_transactions_deal_payout_once%'`);
    const FIVE = ['appearance_fee', 'partnership_base_fee', 'performance_fee', 'content_fee', 'deal_bonus'];

    await migration.up(qi);
    await migration.up(qi);
    await pr1.up(qi); // PR 1's IF NOT EXISTS finds the name taken
    let found = await indexes();
    expect(found.map((i) => i.indexname)).toEqual(['financial_transactions_deal_payout_once']);
    for (const c of FIVE) expect(found[0].indexdef).toContain(c);

    await migration.down(qi);
    found = await indexes();
    expect(found.map((i) => i.indexname)).toEqual(['financial_transactions_deal_payout_once']);
    expect(found[0].indexdef).not.toContain('partnership_base_fee');
    expect(found[0].indexdef).toContain('appearance_fee');

    await migration.up(qi);
    found = await indexes();
    for (const c of FIVE) expect(found[0].indexdef).toContain(c);
  });

  it('the index refuses a second executed partnership base or performance fee for one event', async () => {
    const ids = await seed({ deal_type: 'brand_partnership' });
    const row = (category) => run(
      `INSERT INTO financial_transactions (id, show_id, event_id, type, category, amount, source_type, source_id, status, created_at, updated_at)
       VALUES (:id, :show, :event, 'income', :category, 100, 'event', :event, 'executed', NOW(), NOW())`,
      { ...ids, id: uuid(), category });
    for (const category of ['partnership_base_fee', 'performance_fee']) {
      await row(category);
      await expect(row(category)).rejects.toMatchObject({ name: 'SequelizeUniqueConstraintError' });
    }
  });
});
