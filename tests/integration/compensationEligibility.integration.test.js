/**
 * Compensation eligibility (A2; Evoni's rulings of 2026-11-13 and 14).
 *
 * Brand compensation is owed for an event only under an accepted agreement.
 * Complete (the deal's fees and bonus), Finalize (a legacy event's payment
 * and its content revenue) and deliverable approval (the content fee) each
 * ask services/startOfferDecision resolveEventCompensation first, in their
 * own transaction with the offer rows locked.
 *
 *   no offer linked                           owed, as before
 *   owner accepted, no other live offer       owed
 *   owner open or closed, no other live offer not owed; the episode completes
 *   anything else, on an event with terms     409 OFFER_RESOLUTION_REQUIRED,
 *                                             everything rolled back
 *
 * The owner is the offer the event was made from (world_events.
 * opportunity_id) when it points back (opportunities.event_id). Lala's own
 * costs book either way. Nothing here adds a table, a ledger or a status.
 */
jest.unmock('uuid');

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: async () => { throw new Error('the model must not be asked'); } } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { finalizeEpisodeFinancials, getCurrentBalance } = require('../../src/services/financialTransactionService');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { getEpisodeMoney } = require('../../src/services/episodeMoneyService');
const { COMPENSATION_CATEGORIES } = require('../../src/services/episodeMoneyLines');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

const ADMIN = { id: 'test-admin-a2', name: 'Admin' };
const COST = 80;
const FEE = 120;
const APPEARANCE = 450;
const BONUS = { slay: 300, pass: 200, safe: 100 };
const DEAL = { deal_components: ['paid_to_appear', 'paid_for_content'], appearance_fee: APPEARANCE, bonus_terms: BONUS, host_brand: 'Maison Belle' };
const LEGACY = { event_type: 'brand_deal', is_paid: true, payment_amount: 800, host_brand: 'Maison Belle' };
const NO_TERMS = { cost_coins: 300 };

(shouldSkip ? describe.skip : describe)('Compensation eligibility (A2)', () => {
  const shows = [];
  let admin;
  let n = 0;
  const as = (r) => r.set('X-Forwarded-For', `10.81.${Math.floor(n / 250)}.${(n % 250) + 1}`).set('Authorization', `Bearer ${admin}`);

  beforeAll(() => {
    admin = TokenService.generateTokenPair({ id: ADMIN.id, email: 'admin@a2.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
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
      await del(`DELETE FROM activity_logs WHERE resource_id IN (SELECT id::text FROM episodes WHERE show_id IN (:shows))
                    OR resource_id IN (SELECT id::text FROM opportunities WHERE show_id IN (:shows))
                    OR resource_id IN (SELECT d.id::text FROM event_deliverables d JOIN world_events e ON e.id = d.event_id WHERE e.show_id IN (:shows))`);
      for (const t of ['financial_transactions', 'character_state_history', 'character_state']) await del(`DELETE FROM ${t} WHERE show_id IN (:shows)`);
      await del('DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id IN (:shows))');
      await del('DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id IN (:shows))');
      await del('UPDATE world_events SET used_in_episode_id = NULL, opportunity_id = NULL WHERE show_id IN (:shows)');
      await del('UPDATE opportunities SET event_id = NULL, episode_id = NULL, offered_in_episode_id = NULL WHERE show_id IN (:shows)');
      await del('DELETE FROM opportunities WHERE show_id IN (:shows)');
      await del('DELETE FROM episodes WHERE show_id IN (:shows)');
      await del('DELETE FROM world_events WHERE show_id IN (:shows)');
      await del('DELETE FROM shows WHERE id IN (:shows)');
    }
    await sequelize.close();
  });

  /**
   * A show at 1000 coins; a draft episode started from the event; one cost
   * of 80 Lala pays and one submitted deliverable with a fee of 120 when the
   * event is a deal. `offers`: [{ key, status, link }], link one of
   *   'owner'      the event names it and it points back
   *   'attached'   it points at the event; the event does not name it
   *   'named_only' the event names it; it points at another event
   */
  async function seed(event = DEAL, offers = []) {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), other: uuid(), deliverable: uuid(), cost: uuid(), state: uuid(), opp: {} };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :name, CAST(:meta AS jsonb), NOW(), NOW())`,
      { ...ids, name: `a2-${ids.show.slice(0, 8)}`, meta: JSON.stringify({ starting_balance: 1000 }) });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, ids);
    for (const o of offers) {
      ids.opp[o.key] = uuid();
      await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, status_history, payment_amount, created_at, updated_at)
                 VALUES (:id, :show, :name, 'campaign', :status, CAST(:history AS jsonb), 900, NOW(), NOW())`,
      { id: ids.opp[o.key], show: ids.show, name: `Offer ${o.key}`, status: o.status, history: JSON.stringify([{ status: o.status, date: '2026-11-01T10:00:00.000Z' }]) });
    }
    const named = offers.find((o) => o.link === 'owner' || o.link === 'named_only');
    const e = { deal_type: null, deal_components: null, event_type: 'invite', cost_coins: 0, is_paid: false, payment_amount: 0, appearance_fee: null, bonus_terms: null, host_brand: null, ...event };
    const isDeal = Array.isArray(e.deal_components);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, event_type, deal_type, deal_components, cost_coins, is_paid, payment_amount,
                 appearance_fee, appearance_required, bonus_terms, host, host_brand, prestige, opportunity_id, created_at, updated_at)
               VALUES (:event, :show, 'Velour Night', 'used', :ep, :event_type, :deal_type, CAST(:components AS jsonb), :cost_coins, :is_paid, :payment_amount,
                 :appearance_fee, false, :bonus_terms, 'Nia Vale', :host_brand, 5, :owner, NOW(), NOW())`,
    { ...ids, ...e, components: isDeal ? JSON.stringify(e.deal_components) : null, bonus_terms: e.bonus_terms ? JSON.stringify(e.bonus_terms) : null,
      owner: named ? ids.opp[named.key] : null });
    await run(`INSERT INTO world_events (id, show_id, name, status, event_type, prestige, created_at, updated_at) VALUES (:other, :show, 'Another Night', 'ready', 'invite', 5, NOW(), NOW())`, ids);
    for (const o of offers) {
      const target = o.link === 'named_only' ? ids.other : ids.event;
      await run('UPDATE opportunities SET event_id = :target WHERE id = :id', { target, id: ids.opp[o.key] });
    }
    if (isDeal) {
      await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at) VALUES (:cost, :event, 'travel', 'Car to the gala', :amount, 'lala', NOW(), NOW())`,
        { ...ids, amount: COST });
      await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, required, owed_to, fee, status, episode_id, created_at, updated_at)
                 VALUES (:deliverable, :event, 'One reel in the coat', 'reel', true, 'brand', :fee, 'submitted', :ep, NOW(), NOW())`, { ...ids, fee: FEE });
    }
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:state, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, ids);
    return ids;
  }

  const complete = (ids) => completeEpisode(ids.ep, ids.show, sequelize, { decidedBy: ADMIN });
  const finalize = (ids) => finalizeEpisodeFinancials(ids.ep, ids.show, sequelize, { actor: ADMIN });
  const approve = (ids) => as(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${ids.deliverable}/status`)).send({ status: 'approved' });
  const deliverables = async (ids) => (await as(request(app).get(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables`))).body.deliverables;
  const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  // The money booked, without the show's opening bankroll (the 'seed' row
  // the first ledger writer leaves, whoever it is).
  const ledger = (ids) => q(
    `SELECT category, type, amount::float AS amount FROM financial_transactions
      WHERE show_id = :show AND status = 'executed' AND deleted_at IS NULL AND category <> 'seed' ORDER BY category, amount`, ids);
  // Every row, the opening one included, whatever its status.
  const everyLedgerRow = (ids) => q(
    `SELECT category, type, amount::float AS amount, status, episode_id, source_id FROM financial_transactions
      WHERE show_id = :show AND deleted_at IS NULL ORDER BY created_at, category`, ids);
  const income = (rows) => rows.filter((r) => COMPENSATION_CATEGORIES.includes(r.category));
  const costs = (rows) => rows.filter((r) => r.type === 'expense');
  const offer = async (id) => (await q('SELECT status, status_history, episode_id FROM opportunities WHERE id = :id', { id }))[0];
  const logs = (resourceId, action) => q(
    'SELECT user_id, action, resource_type, changes FROM activity_logs WHERE resource_id = :resourceId AND action = :action ORDER BY id', { resourceId: String(resourceId), action });
  const episode = async (ids) => {
    const [ep] = await q('SELECT evaluation_status, total_income::float AS total_income, total_expenses::float AS total_expenses, evaluation_json FROM episodes WHERE id = :ep', ids);
    return { ...ep, evaluation: asJson(ep.evaluation_json) || {} };
  };
  const coins = async (ids) => (await q('SELECT coins FROM character_state WHERE id = :state', ids))[0].coins;
  /** Everything a refused operation must leave as it was. */
  const snapshot = async (ids) => ({
    ledger: await ledger(ids),
    episode: (await episode(ids)).evaluation_status,
    coins: await coins(ids),
    offers: await q('SELECT id, status, status_history, episode_id FROM opportunities WHERE show_id = :show ORDER BY id', ids),
    deliverable: (await q('SELECT status FROM event_deliverables WHERE event_id = :event', ids))[0]?.status || null,
    event: (await q('SELECT status FROM world_events WHERE id = :event', ids))[0].status,
    history: (await q('SELECT COUNT(*)::int AS n FROM character_state_history WHERE show_id = :show', ids))[0].n,
    logs: (await q(`SELECT COUNT(*)::int AS n FROM activity_logs WHERE resource_id IN (:ids)`,
      { ids: [ids.ep, ids.deliverable, ...Object.values(ids.opp)].map(String) }))[0].n,
  });
  const refused = async (fn) => { try { await fn(); } catch (err) { return err; } return null; };

  // ── The decision table at Complete ──────────────────────────────────────

  describe('Complete', () => {
    it('no offer linked: paid as it always was, and no compensation record is kept', async () => {
      const ids = await seed(DEAL);
      await complete(ids);
      const rows = await ledger(ids);
      expect(income(rows).map((r) => r.category)).toEqual(expect.arrayContaining(['appearance_fee']));
      expect((await episode(ids)).evaluation.compensation).toBeUndefined();
      expect(await logs(ids.ep, 'compensation_withheld')).toHaveLength(0);
    });

    it('owner accepted, alone: paid exactly as an event with no offer is', async () => {
      const plain = await seed(DEAL);
      await complete(plain);
      for (const status of ['booked', 'preparing', 'active']) {
        const ids = await seed(DEAL, [{ key: 'a', status, link: 'owner' }]);
        await complete(ids);
        expect(await ledger(ids)).toEqual(await ledger(plain));
        expect(await coins(ids)).toBe(await coins(plain));
        const record = (await episode(ids)).evaluation.compensation;
        expect(record).toMatchObject({ owed: true, reason: 'owner_accepted', withheld: [] });
        expect(record.owner).toEqual({ id: ids.opp.a, name: 'Offer a', status });
        expect(await logs(ids.ep, 'compensation_withheld')).toHaveLength(0);
      }
    });

    it('owner accepted with a declined offer beside it: owed, the declined one creates nothing', async () => {
      const plain = await seed(DEAL);
      await complete(plain);
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }, { key: 'b', status: 'declined', link: 'attached' }]);
      await complete(ids);
      expect(await ledger(ids)).toEqual(await ledger(plain));
      expect((await offer(ids.opp.b)).status).toBe('declined');
      expect((await offer(ids.opp.b)).status_history).toHaveLength(1);
    });

    it.each([
      ['open (Start Without Accepting leaves it so)', 'considering', 'owner_not_accepted'],
      ['offered', 'offered', 'owner_not_accepted'],
      ['negotiating', 'negotiating', 'owner_not_accepted'],
      ['declined', 'declined', 'owner_closed'],
      ['cancelled', 'cancelled', 'owner_closed'],
      ['expired', 'expired', 'owner_closed'],
    ])('owner %s: the episode completes with no brand income, and Lala\'s own costs book as usual', async (_name, status, reason) => {
      const plain = await seed(DEAL);
      await complete(plain);
      const ids = await seed(DEAL, [{ key: 'a', status, link: 'owner' }]);
      const result = await complete(ids);
      const rows = await ledger(ids);
      // No compensation row of any kind.
      expect(income(rows)).toEqual([]);
      // Her costs are exactly those of the paid twin.
      expect(costs(rows)).toEqual(costs(await ledger(plain)));
      expect(costs(rows)).toEqual([{ category: 'event_cost', type: 'expense', amount: COST }]);
      expect(await coins(ids)).toBe(1000 - COST);
      const ep = await episode(ids);
      expect(ep.evaluation_status).toBe('accepted');
      expect(ep.total_income).toBe(0);
      expect(ep.total_expenses).toBe(COST);
      // What was withheld and why, in the evaluation, the result and the audit trail.
      const record = ep.evaluation.compensation;
      expect(record).toMatchObject({ owed: false, reason, owner: { id: ids.opp.a, status } });
      expect(record.withheld.find((w) => w.category === 'appearance_fee')).toEqual({ category: 'appearance_fee', amount: APPEARANCE });
      expect(ep.evaluation.stat_deltas._financial_context.compensation).toEqual(record);
      expect(result.compensation).toEqual(record);
      const [entry, ...more] = await logs(ids.ep, 'compensation_withheld');
      expect(more).toHaveLength(0);
      expect(entry).toMatchObject({ user_id: ADMIN.id, resource_type: 'episode' });
      expect(entry.changes.meta).toMatchObject({ at: 'complete', reason, opportunity_id: ids.opp.a, opportunity_status: status, event_id: ids.event, show_id: ids.show });
      expect(entry.changes.meta.withheld).toEqual(record.withheld);
      // The offer is not touched: not accepted, so never completed.
      const after = await offer(ids.opp.a);
      expect(after.status).toBe(status);
      expect(after.status_history).toHaveLength(1);
    });

    const UNRESOLVED = [
      ['an ownerless event with one linked accepted offer', [{ key: 'b', status: 'booked', link: 'attached' }], 'no_owner'],
      ['an ownerless event with one linked open offer', [{ key: 'b', status: 'offered', link: 'attached' }], 'no_owner'],
      ['conflicting pointers: the event names an offer that points elsewhere', [{ key: 'a', status: 'booked', link: 'named_only' }], 'owner_link_conflict'],
      ['a declined owner and an accepted offer that is not the owner', [{ key: 'a', status: 'declined', link: 'owner' }, { key: 'b', status: 'booked', link: 'attached' }], 'multiple_live_offers'],
      ['an accepted owner and another open offer', [{ key: 'a', status: 'booked', link: 'owner' }, { key: 'b', status: 'negotiating', link: 'attached' }], 'multiple_live_offers'],
      ['several accepted offers', [{ key: 'a', status: 'booked', link: 'owner' }, { key: 'b', status: 'active', link: 'attached' }], 'multiple_live_offers'],
      ['an open owner and another open offer', [{ key: 'a', status: 'offered', link: 'owner' }, { key: 'b', status: 'considering', link: 'attached' }], 'multiple_live_offers'],
    ];

    it.each(UNRESOLVED)('%s, with terms: 409 OFFER_RESOLUTION_REQUIRED and everything is as it was', async (_name, offers, reason) => {
      const ids = await seed(DEAL, offers);
      const before = await snapshot(ids);
      const err = await refused(() => complete(ids));
      expect(err).toMatchObject({ code: 'OFFER_RESOLUTION_REQUIRED', status: 409 });
      expect(err.toJSON()).toMatchObject({ success: false, code: 'OFFER_RESOLUTION_REQUIRED', reason });
      // The refusal names the offers, never their terms.
      expect(err.toJSON().offers.map((o) => Object.keys(o).sort())).toEqual(offers.map(() => ['id', 'name', 'status']));
      expect(JSON.stringify(err.toJSON())).not.toMatch(/900|payment/);
      expect(await snapshot(ids)).toEqual(before);
    });

    it.each(UNRESOLVED)('%s, with no compensation terms: nothing to book, so the episode completes', async (_name, offers) => {
      const plain = await seed(NO_TERMS);
      await complete(plain);
      const ids = await seed(NO_TERMS, offers);
      await complete(ids);
      const rows = await ledger(ids);
      expect((await episode(ids)).evaluation_status).toBe('accepted');
      expect(income(rows)).toEqual([]);
      // Her costs are those of the same event with no offer at all.
      expect(rows).toEqual(await ledger(plain));
      expect(costs(rows)).toEqual(expect.arrayContaining([{ category: 'event_entry', type: 'expense', amount: 300 }]));
    });

    it('the event names an offer that has been deleted: 409, not a guess', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }]);
      await run('UPDATE opportunities SET deleted_at = NOW() WHERE id = :id', { id: ids.opp.a });
      const before = await snapshot(ids);
      const err = await refused(() => complete(ids));
      expect(err?.toJSON()).toMatchObject({ code: 'OFFER_RESOLUTION_REQUIRED', reason: 'owner_missing' });
      expect(await snapshot(ids)).toEqual(before);
    });

    it('the route answers the 409 with the refusal, and resolving the offers lets it complete', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }, { key: 'b', status: 'negotiating', link: 'attached' }]);
      const url = `/api/v1/world/${ids.show}/episodes/${ids.ep}/complete`;
      const res = await as(request(app).post(url)).send({});
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'OFFER_RESOLUTION_REQUIRED', reason: 'multiple_live_offers' });
      expect((await episode(ids)).evaluation_status).not.toBe('accepted');
      // An admin closes the offer that does not apply (A1's Advance, with its reason).
      const closed = await as(request(app).post(`/api/v1/opportunities/${ids.show}/${ids.opp.b}/advance`)).send({ to_status: 'declined', reason: 'Not the agreement for this event' });
      expect(closed.status).toBe(200);
      const ok = await as(request(app).post(url)).send({});
      expect(ok.status).toBe(200);
      expect(income(await ledger(ids)).some((r) => r.category === 'appearance_fee')).toBe(true);
    });

    it('a legacy paid event follows the same rule: payment and content revenue only when owed', async () => {
      const owed = await seed(LEGACY, [{ key: 'a', status: 'booked', link: 'owner' }]);
      await complete(owed);
      expect(income(await ledger(owed))).toEqual([{ category: 'content_revenue', type: 'income', amount: 80 }, { category: 'event_payment', type: 'income', amount: 800 }]);

      const not = await seed(LEGACY, [{ key: 'a', status: 'declined', link: 'owner' }]);
      await complete(not);
      expect(income(await ledger(not))).toEqual([]);
      expect((await episode(not)).evaluation.compensation.withheld).toEqual([
        { category: 'event_payment', amount: 800 }, { category: 'content_revenue', amount: 80 },
      ]);

      const unresolved = await seed(LEGACY, [{ key: 'b', status: 'booked', link: 'attached' }]);
      expect((await refused(() => complete(unresolved)))?.code).toBe('OFFER_RESOLUTION_REQUIRED');
    });

    it('completing again changes nothing: one set of rows, one record, one transition', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }]);
      await complete(ids);
      const after = await snapshot(ids);
      const again = await complete(ids);
      expect(again.already_completed).toBe(true);
      expect(await snapshot(ids)).toEqual(after);
      const two = await Promise.all([complete(ids), complete(ids)]);
      expect(two.every((r) => r.already_completed)).toBe(true);
      expect(await snapshot(ids)).toEqual(after);
    });

    it('two completions at once: one books, one finds it done', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'declined', link: 'owner' }]);
      const results = await Promise.all([complete(ids), complete(ids)]);
      expect(results.filter((r) => r.already_completed)).toHaveLength(1);
      expect(income(await ledger(ids))).toEqual([]);
      expect(costs(await ledger(ids))).toHaveLength(1);
      expect(await logs(ids.ep, 'compensation_withheld')).toHaveLength(1);
    });

    it('an Advance racing the completion: the income is booked exactly when the completion read the offer as accepted', async () => {
      for (let i = 0; i < 3; i += 1) {
        const ids = await seed(DEAL, [{ key: 'a', status: 'negotiating', link: 'owner' }]);
        const advance = as(request(app).post(`/api/v1/opportunities/${ids.show}/${ids.opp.a}/advance`)).send({ to_status: 'booked', from_status: 'negotiating' });
        const [, moved] = await Promise.all([complete(ids), advance]);
        expect(moved.status).toBe(200);
        const record = (await episode(ids)).evaluation.compensation;
        const paid = income(await ledger(ids)).some((r) => r.category === 'appearance_fee');
        expect(paid).toBe(record.owed);
        expect(record.reason).toBe(record.owed ? 'owner_accepted' : 'owner_not_accepted');
        // Never both paid and withheld.
        expect(record.withheld.length > 0).toBe(!record.owed);
      }
    });
  });

  // ── Finalize on its own ─────────────────────────────────────────────────

  describe('Finalize', () => {
    it('not owed: the payment is withheld and recorded, and the costs book', async () => {
      const ids = await seed({ ...LEGACY, cost_coins: 0 }, [{ key: 'a', status: 'offered', link: 'owner' }]);
      const result = await finalize(ids);
      expect(income(await ledger(ids))).toEqual([]);
      expect(result.compensation).toMatchObject({ owed: false, reason: 'owner_not_accepted', withheld: [{ category: 'event_payment', amount: 800 }, { category: 'content_revenue', amount: 80 }] });
      const entries = await logs(ids.ep, 'compensation_withheld');
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ user_id: ADMIN.id });
      expect(entries[0].changes.meta).toMatchObject({ at: 'finalize', reason: 'owner_not_accepted' });
    });

    it('unresolved with terms: 409, and the whole finalize rolls back, costs included', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }, { key: 'b', status: 'booked', link: 'attached' }]);
      const before = await snapshot(ids);
      const err = await refused(() => finalize(ids));
      expect(err?.code).toBe('OFFER_RESOLUTION_REQUIRED');
      expect(await snapshot(ids)).toEqual(before);
      const res = await as(request(app).post(`/api/v1/world/${ids.show}/episodes/${ids.ep}/finalize-financials`)).send({});
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('OFFER_RESOLUTION_REQUIRED');
      expect(await snapshot(ids)).toEqual(before);
    });

    it('owed, and no offer at all: as before', async () => {
      const plain = await seed(LEGACY);
      await finalize(plain);
      const owed = await seed(LEGACY, [{ key: 'a', status: 'active', link: 'owner' }]);
      await finalize(owed);
      expect(await ledger(owed)).toEqual(await ledger(plain));
      expect(await logs(owed.ep, 'compensation_withheld')).toHaveLength(0);
    });

    it('finalized first, completed later: the same ledger and the same decision as a direct completion', async () => {
      for (const status of ['booked', 'declined']) {
        const direct = await seed(DEAL, [{ key: 'a', status, link: 'owner' }]);
        await complete(direct);
        const later = await seed(DEAL, [{ key: 'a', status, link: 'owner' }]);
        await finalize(later);
        await complete(later);
        expect(await ledger(later)).toEqual(await ledger(direct));
        const a = (await episode(direct)).evaluation.compensation;
        const b = (await episode(later)).evaluation.compensation;
        expect({ owed: b.owed, reason: b.reason, withheld: b.withheld }).toEqual({ owed: a.owed, reason: a.reason, withheld: a.withheld });
      }
    });

    it('finalizing twice books once', async () => {
      const ids = await seed({ ...LEGACY, cost_coins: 0 }, [{ key: 'a', status: 'booked', link: 'owner' }]);
      await finalize(ids);
      const after = await ledger(ids);
      expect((await finalize(ids)).already_finalized).toBe(true);
      expect(await ledger(ids)).toEqual(after);
    });
  });

  // ── Deliverable approval ────────────────────────────────────────────────

  describe('Deliverable approval', () => {
    it('owed: approved and the fee is booked; the list shows proposed and booked', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }]);
      const [before] = await deliverables(ids);
      expect(before).toMatchObject({ proposed_fee: FEE, booked_fee: null, fee_state: 'expected', fee_reason: null });
      const res = await approve(ids);
      expect(res.status).toBe(200);
      expect(res.body.content_fee).toMatchObject({ amount: FEE });
      expect(res.body.content_fee_withheld).toBeNull();
      expect(income(await ledger(ids))).toEqual([{ category: 'content_fee', type: 'income', amount: FEE }]);
      const [after] = await deliverables(ids);
      expect(after).toMatchObject({ status: 'approved', proposed_fee: FEE, booked_fee: FEE, fee_state: 'booked' });
      expect(await logs(ids.deliverable, 'content_fee_withheld')).toHaveLength(0);
    });

    it('not owed: the deliverable is still approved, no fee is booked, and why is recorded with it', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'declined', link: 'owner' }]);
      const [before] = await deliverables(ids);
      expect(before).toMatchObject({ proposed_fee: FEE, booked_fee: null, fee_state: 'not_owed', fee_reason: 'owner_closed' });
      const res = await approve(ids);
      expect(res.status).toBe(200);
      expect(res.body.deliverable.status).toBe('approved');
      expect(res.body.content_fee).toBeNull();
      expect(res.body.content_fee_withheld).toEqual({ reason: 'owner_closed', proposed_fee: FEE, opportunity_id: ids.opp.a, opportunity_status: 'declined' });
      expect(await ledger(ids)).toEqual([]);
      expect(await coins(ids)).toBe(1000);
      // The approval takes the ledger's lock before it reads the offers, and
      // the first lock on a show's ledger writes its opening row. That row is
      // all there is: the bankroll the show started with, and no income.
      expect(await everyLedgerRow(ids)).toEqual([{ category: 'seed', type: 'income', amount: 1000, status: 'executed', episode_id: null, source_id: null }]);
      expect(await getCurrentBalance(sequelize, ids.show)).toBe(1000);
      const reported = await as(request(app).get(`/api/v1/world/${ids.show}/balance`));
      expect(reported.body.balance).toBe(1000);
      expect((await episode(ids)).total_income || 0).toBe(0);
      // Approving it again (a repeat of the same request) writes no second opening row.
      await approve(ids);
      expect(await everyLedgerRow(ids)).toHaveLength(1);
      expect(await coins(ids)).toBe(1000);
      const entries = await logs(ids.deliverable, 'content_fee_withheld');
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ user_id: ADMIN.id, resource_type: 'event_deliverable' });
      expect(entries[0].changes.meta).toMatchObject({ reason: 'owner_closed', proposed_fee: FEE, event_id: ids.event, episode_id: ids.ep, opportunity_id: ids.opp.a });
      const [after] = await deliverables(ids);
      expect(after).toMatchObject({ status: 'approved', proposed_fee: FEE, booked_fee: null, fee_state: 'not_owed', fee_reason: 'owner_closed' });
    });

    it('accepted after the approval: still approved, still no fee, and the reason reads as it was recorded', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'negotiating', link: 'owner' }]);
      expect((await approve(ids)).status).toBe(200);
      const late = await as(request(app).post(`/api/v1/opportunities/${ids.show}/${ids.opp.a}/advance`)).send({ to_status: 'booked' });
      expect(late.status).toBe(200);
      const [d] = await deliverables(ids);
      expect(d).toMatchObject({ status: 'approved', booked_fee: null, fee_state: 'not_owed', fee_reason: 'owner_not_accepted' });
      expect(await ledger(ids)).toEqual([]);
    });

    it('unresolved: 409, and the approval rolls back with it', async () => {
      const ids = await seed(DEAL, [{ key: 'b', status: 'booked', link: 'attached' }]);
      const [shown] = await deliverables(ids);
      expect(shown).toMatchObject({ fee_state: 'unresolved', fee_reason: 'no_owner' });
      const before = await snapshot(ids);
      const res = await approve(ids);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'OFFER_RESOLUTION_REQUIRED', reason: 'no_owner' });
      expect(await snapshot(ids)).toEqual(before);
      expect(before.deliverable).toBe('submitted');
    });

    it('no offer linked: booked as before', async () => {
      const ids = await seed(DEAL);
      const res = await approve(ids);
      expect(res.status).toBe(200);
      expect(income(await ledger(ids))).toEqual([{ category: 'content_fee', type: 'income', amount: FEE }]);
    });

    it('a deliverable with no fee is approved whatever the offers are: nothing to book, nothing to resolve', async () => {
      const ids = await seed(DEAL, [{ key: 'b', status: 'booked', link: 'attached' }]);
      await run('UPDATE event_deliverables SET fee = 0 WHERE id = :deliverable', ids);
      const res = await approve(ids);
      expect(res.status).toBe(200);
      expect(res.body.content_fee).toBeNull();
      expect(res.body.content_fee_withheld).toBeNull();
      expect((await deliverables(ids))[0]).toMatchObject({ status: 'approved', proposed_fee: null, fee_state: 'none' });
    });

    it.each([['owed', 'booked'], ['not owed', 'declined']])('two approvals at once (%s): one approval, one fee or one reason, never two', async (_name, status) => {
      const ids = await seed(DEAL, [{ key: 'a', status, link: 'owner' }]);
      const results = await Promise.all([approve(ids), approve(ids), approve(ids)]);
      expect(results.map((r) => r.status).filter((s) => s === 200)).toHaveLength(1);
      expect(income(await ledger(ids))).toHaveLength(status === 'booked' ? 1 : 0);
      expect(await logs(ids.deliverable, 'content_fee_withheld')).toHaveLength(status === 'booked' ? 0 : 1);
      // A repeat afterwards changes nothing.
      const again = await approve(ids);
      expect(again.status).not.toBe(200);
      expect(income(await ledger(ids))).toHaveLength(status === 'booked' ? 1 : 0);
      expect(await logs(ids.deliverable, 'content_fee_withheld')).toHaveLength(status === 'booked' ? 0 : 1);
    });

    it('the reason that cannot be written takes the approval with it', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'declined', link: 'owner' }]);
      const before = await snapshot(ids);
      jest.spyOn(models.ActivityLog, 'logActivity').mockRejectedValueOnce(new Error('the audit trail is down'));
      const res = await approve(ids);
      expect(res.status).toBe(500);
      expect(await snapshot(ids)).toEqual(before);
    });
  });

  // ── The owner's transition at completion ────────────────────────────────

  describe('The owner offer is completed with the episode', () => {
    it.each(['booked', 'preparing', 'active'])('an accepted owner (%s) moves to completed: one history entry, one audit entry, in the completion', async (status) => {
      const ids = await seed(DEAL, [{ key: 'a', status, link: 'owner' }]);
      const result = await complete(ids);
      const after = await offer(ids.opp.a);
      expect(after.status).toBe('completed');
      expect(after.episode_id).toBe(ids.ep);
      // One transition, from the status it had: no entry is made up for a status it never held.
      expect(after.status_history).toHaveLength(2);
      expect(after.status_history[1]).toMatchObject({
        status: 'completed', from: status, by: { id: ADMIN.id }, reason: null, route: 'episode_completed', event_id: ids.event, episode_id: ids.ep,
      });
      const entries = await logs(ids.opp.a, 'opportunity_status');
      expect(entries).toHaveLength(1);
      expect(entries[0].changes.meta).toEqual({
        route: 'episode_completed', from_status: status, to_status: 'completed', reason: null, show_id: ids.show, event_id: ids.event, episode_id: ids.ep,
      });
      expect(result.career.opportunities_advanced).toEqual([{ id: ids.opp.a, name: 'Offer a', from: status, to: 'completed' }]);
    });

    it('only the owner moves: a closed offer beside it is not touched', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }, { key: 'b', status: 'declined', link: 'attached' }, { key: 'c', status: 'archived', link: 'attached' }]);
      await complete(ids);
      expect((await offer(ids.opp.a)).status).toBe('completed');
      for (const key of ['b', 'c']) {
        const o = await offer(ids.opp[key]);
        expect(o.status_history).toHaveLength(1);
        expect(o.episode_id).toBeNull();
        expect(await logs(ids.opp[key], 'opportunity_status')).toHaveLength(0);
      }
    });

    it.each(['completed', 'paid'])('an owner already %s is left as it is', async (status) => {
      const ids = await seed(DEAL, [{ key: 'a', status, link: 'owner' }]);
      await complete(ids);
      const after = await offer(ids.opp.a);
      expect(after.status).toBe(status);
      expect(after.status_history).toHaveLength(1);
      expect(await logs(ids.opp.a, 'opportunity_status')).toHaveLength(0);
    });

    it('no owner: no offer is picked, even an accepted one that points at the event', async () => {
      const ids = await seed(NO_TERMS, [{ key: 'b', status: 'booked', link: 'attached' }]);
      const result = await complete(ids);
      const after = await offer(ids.opp.b);
      expect(after.status).toBe('booked');
      expect(after.status_history).toHaveLength(1);
      expect(result.career.opportunities_advanced).toEqual([]);
    });

    it('an open owner is listed for review and left open', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'considering', link: 'owner' }]);
      const result = await complete(ids);
      expect(result.career.opportunities_unaccepted).toEqual([{ id: ids.opp.a, name: 'Offer a', status: 'considering' }]);
      expect((await offer(ids.opp.a)).status).toBe('considering');
    });

    it('the transition that cannot be recorded rolls the whole completion back', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }]);
      const before = await snapshot(ids);
      const spy = jest.spyOn(models.ActivityLog, 'logActivity').mockRejectedValueOnce(new Error('the audit trail is down'));
      const err = await refused(() => complete(ids));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(err?.message).toBe('the audit trail is down');
      expect(await snapshot(ids)).toEqual(before);
      // And it completes cleanly afterwards.
      await complete(ids);
      expect((await offer(ids.opp.a)).status).toBe('completed');
      expect(await logs(ids.opp.a, 'opportunity_status')).toHaveLength(1);
    });
  });

  // ── The admin episode-complete route (Evoni's ruling of 2026-11-15) ─────
  // POST /opportunities/:showId/episode-complete/:episodeId used to pick an
  // offer by the event's pointer, else by episode, else by event, and write
  // it with no lock and no audit entry. It now moves the owner only, by the
  // step the completion uses.

  describe('The admin episode-complete route', () => {
    const repair = (ids, episodeId = ids.ep) => as(request(app).post(`/api/v1/opportunities/${ids.show}/episode-complete/${episodeId}`)).send({});
    const advance = (ids, key, from, to) => as(request(app).post(`/api/v1/opportunities/${ids.show}/${ids.opp[key]}/advance`)).send({ to_status: to, from_status: from });
    const NOTHING = { success: true, message: 'Pipeline cascade complete.', data: { opportunities_advanced: [], opportunities_unaccepted: [] } };

    it('1. moves the owner once, with one history entry and one audit entry, and books nothing', async () => {
      // Completed while the owner was still open, accepted since.
      const ids = await seed(DEAL, [{ key: 'a', status: 'negotiating', link: 'owner' }]);
      await complete(ids);
      expect((await advance(ids, 'a', 'negotiating', 'booked')).status).toBe(200);
      const before = await snapshot(ids);
      const rowsBefore = await everyLedgerRow(ids);
      const record = (await episode(ids)).evaluation.compensation;

      const res = await repair(ids);
      expect(res.status).toBe(200);
      // The response it always gave.
      expect(res.body).toEqual({ success: true, message: 'Pipeline cascade complete.', data: {
        opportunities_advanced: [{ id: ids.opp.a, name: 'Offer a', from: 'booked', to: 'completed' }], opportunities_unaccepted: [] } });

      const after = await offer(ids.opp.a);
      expect(after.status).toBe('completed');
      expect(after.episode_id).toBe(ids.ep);
      const completions = after.status_history.filter((h) => h.status === 'completed');
      expect(completions).toHaveLength(1);
      expect(completions[0]).toMatchObject({ from: 'booked', by: { id: ADMIN.id }, route: 'episode_completed', event_id: ids.event, episode_id: ids.ep });
      const entries = (await logs(ids.opp.a, 'opportunity_status')).filter((l) => l.changes.meta.to_status === 'completed');
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ user_id: ADMIN.id, resource_type: 'opportunity' });
      expect(entries[0].changes.meta).toMatchObject({ route: 'episode_completed', from_status: 'booked', to_status: 'completed', event_id: ids.event, episode_id: ids.ep });

      // No completion is run again and no money moves: what was withheld stays withheld.
      const now = await snapshot(ids);
      expect(now.ledger).toEqual(before.ledger);
      expect(await everyLedgerRow(ids)).toEqual(rowsBefore);
      expect(now.coins).toBe(before.coins);
      expect(now.history).toBe(before.history);
      expect(now.episode).toBe('accepted');
      expect((await episode(ids)).evaluation.compensation).toEqual(record);
      expect(await logs(ids.ep, 'compensation_withheld')).toHaveLength(1);
    });

    it('2. never moves an offer that is not the owner: 409, and nothing changes', async () => {
      // An accepted offer that only points at the event, which names no owner.
      const attached = await seed(NO_TERMS, [{ key: 'b', status: 'booked', link: 'attached' }]);
      await complete(attached);
      // The event names an offer that points at another event; another accepted one points here.
      const conflict = await seed(NO_TERMS, [{ key: 'a', status: 'booked', link: 'named_only' }, { key: 'b', status: 'booked', link: 'attached' }]);
      await complete(conflict);
      // The owner named has been deleted; an accepted offer names the episode.
      const missing = await seed(NO_TERMS, [{ key: 'a', status: 'considering', link: 'owner' }, { key: 'b', status: 'declined', link: 'attached' }]);
      await complete(missing);
      await run(`UPDATE opportunities SET deleted_at = NOW() WHERE id = :id`, { id: missing.opp.a });
      await run(`UPDATE opportunities SET episode_id = :ep WHERE id = :id`, { ep: missing.ep, id: missing.opp.b });
      // No event at all, and an accepted offer that names the episode: the old route's second guess.
      const loose = await seed(NO_TERMS, [{ key: 'b', status: 'booked', link: 'attached' }]);
      await complete(loose);
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE id = :event`, loose);
      await run(`UPDATE opportunities SET episode_id = :ep WHERE id = :id`, { ep: loose.ep, id: loose.opp.b });

      for (const [ids, reason] of [[attached, 'no_owner'], [conflict, 'owner_link_conflict'], [missing, 'owner_missing'], [loose, 'no_owner']]) {
        const before = await snapshot(ids);
        const res = await repair(ids);
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ success: false, code: 'OFFER_RESOLUTION_REQUIRED', reason });
        // Named by id, name and status only.
        expect(JSON.stringify(res.body)).not.toMatch(/payment_amount|900/);
        expect(await snapshot(ids)).toEqual(before);
      }
      expect((await offer(attached.opp.b)).status).toBe('booked');
      expect((await offer(loose.opp.b)).status).toBe('booked');
    });

    it('2a. an owner with another live offer on its event: 409 with or without terms, until the other is closed', async () => {
      for (const withTerms of [false, true]) {
        // Completed without terms (Complete's rule, unchanged), the owner still open then, accepted since.
        const ids = await seed(NO_TERMS, [{ key: 'a', status: 'negotiating', link: 'owner' }, { key: 'b', status: 'offered', link: 'attached' }]);
        await complete(ids);
        expect((await episode(ids)).evaluation_status).toBe('accepted');
        expect((await advance(ids, 'a', 'negotiating', 'booked')).status).toBe(200);
        if (withTerms) await run(`UPDATE world_events SET is_paid = true, payment_amount = 800, event_type = 'brand_deal' WHERE id = :event`, ids);
        const before = await snapshot(ids);
        const rowsBefore = await everyLedgerRow(ids);

        const res = await repair(ids);
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ success: false, code: 'OFFER_RESOLUTION_REQUIRED', reason: 'multiple_live_offers' });
        expect(res.body.offers.map((o) => o.id).sort()).toEqual([ids.opp.a, ids.opp.b].sort());
        expect(JSON.stringify(res.body)).not.toMatch(/payment_amount|900/);
        // Neither offer moved and nothing was recorded.
        expect(await snapshot(ids)).toEqual(before);
        expect((await offer(ids.opp.a)).status).toBe('booked');
        expect((await offer(ids.opp.b)).status).toBe('offered');

        // The admin closes the other offer; then the owner is alone and moves, once.
        const closed = await as(request(app).post(`/api/v1/opportunities/${ids.show}/${ids.opp.b}/advance`)).send({ to_status: 'declined', from_status: 'offered', reason: 'Not this event\'s offer' });
        expect(closed.status).toBe(200);
        const ok = await repair(ids);
        expect(ok.status).toBe(200);
        expect(ok.body.data.opportunities_advanced).toEqual([{ id: ids.opp.a, name: 'Offer a', from: 'booked', to: 'completed' }]);
        expect((await repair(ids)).body).toEqual(NOTHING);
        expect((await offer(ids.opp.a)).status_history.filter((h) => h.status === 'completed')).toHaveLength(1);
        expect((await logs(ids.opp.a, 'opportunity_status')).filter((l) => l.changes.meta.to_status === 'completed')).toHaveLength(1);
        expect((await offer(ids.opp.b)).status).toBe('declined');
        expect(await everyLedgerRow(ids)).toEqual(rowsBefore);
      }

      // Two accepted offers, the owner already completed by the completion: still not the route's to settle.
      const both = await seed(NO_TERMS, [{ key: 'a', status: 'booked', link: 'owner' }, { key: 'b', status: 'booked', link: 'attached' }]);
      await complete(both);
      const after = await snapshot(both);
      const res = await repair(both);
      expect(res.status).toBe(409);
      expect(res.body.reason).toBe('multiple_live_offers');
      expect(await snapshot(both)).toEqual(after);
    });

    it('2b. beside a valid owner, no other offer moves; an owner that is open or closed is left as it is', async () => {
      const ids = await seed(NO_TERMS, [{ key: 'a', status: 'negotiating', link: 'owner' }, { key: 'b', status: 'declined', link: 'attached' }]);
      await complete(ids);
      const open = await repair(ids);
      expect(open.status).toBe(200);
      expect(open.body.data).toEqual({ opportunities_advanced: [], opportunities_unaccepted: [{ id: ids.opp.a, name: 'Offer a', status: 'negotiating' }] });
      expect((await advance(ids, 'a', 'negotiating', 'booked')).status).toBe(200);
      expect((await repair(ids)).body.data.opportunities_advanced).toEqual([{ id: ids.opp.a, name: 'Offer a', from: 'booked', to: 'completed' }]);
      const b = await offer(ids.opp.b);
      expect(b.status).toBe('declined');
      expect(b.status_history).toHaveLength(1);
      expect(await logs(ids.opp.b, 'opportunity_status')).toHaveLength(0);

      const closed = await seed(DEAL, [{ key: 'a', status: 'declined', link: 'owner' }]);
      await complete(closed);
      const before = await snapshot(closed);
      expect((await repair(closed)).body).toEqual(NOTHING);
      expect(await snapshot(closed)).toEqual(before);

      // An event with no offer linked at all: nothing to do, and it says so.
      const none = await seed(DEAL, []);
      await complete(none);
      expect((await repair(none)).body).toEqual(NOTHING);
    });

    it('3. an episode that is not completed: 409, and its accepted owner is not moved early', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }]);
      const before = await snapshot(ids);
      const res = await repair(ids);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'EPISODE_NOT_COMPLETED' });
      expect(await snapshot(ids)).toEqual(before);
      expect(await everyLedgerRow(ids)).toEqual([]);
      // An episode of another show, or none: not found.
      const other = await seed(DEAL, []);
      expect((await repair(ids, other.ep)).status).toBe(404);
      expect((await repair(ids, uuid())).status).toBe(404);
      // The completion then does it, once.
      await complete(ids);
      expect((await offer(ids.opp.a)).status_history.filter((h) => h.status === 'completed')).toHaveLength(1);
    });

    it('4. asking again changes nothing', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }]);
      await complete(ids);
      const after = await snapshot(ids);
      // Completed by the completion: the route finds it done.
      for (let i = 0; i < 2; i += 1) {
        const res = await repair(ids);
        expect(res.status).toBe(200);
        expect(res.body).toEqual(NOTHING);
      }
      const both = await Promise.all([repair(ids), repair(ids)]);
      expect(both.map((r) => r.body)).toEqual([NOTHING, NOTHING]);
      expect(await snapshot(ids)).toEqual(after);

      // Moved by the route: two at once move it once.
      const late = await seed(DEAL, [{ key: 'a', status: 'negotiating', link: 'owner' }]);
      await complete(late);
      expect((await advance(late, 'a', 'negotiating', 'booked')).status).toBe(200);
      const pair = await Promise.all([repair(late), repair(late)]);
      expect(pair.map((r) => r.status)).toEqual([200, 200]);
      expect(pair.filter((r) => r.body.data.opportunities_advanced.length === 1)).toHaveLength(1);
      expect((await repair(late)).body).toEqual(NOTHING);
      expect((await offer(late.opp.a)).status_history.filter((h) => h.status === 'completed')).toHaveLength(1);
      expect((await logs(late.opp.a, 'opportunity_status')).filter((l) => l.changes.meta.to_status === 'completed')).toHaveLength(1);
    });

    it('5. is an admin\'s: anyone else is refused before anything is read', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'negotiating', link: 'owner' }]);
      await complete(ids);
      expect((await advance(ids, 'a', 'negotiating', 'booked')).status).toBe(200);
      const before = await snapshot(ids);
      const editor = TokenService.generateTokenPair({ id: 'test-editor-a2', email: 'editor@a2.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
      const url = `/api/v1/opportunities/${ids.show}/episode-complete/${ids.ep}`;
      const asEditor = await request(app).post(url).set('X-Forwarded-For', '10.82.0.1').set('Authorization', `Bearer ${editor}`).send({});
      expect(asEditor.status).toBe(403);
      expect(JSON.stringify(asEditor.body)).not.toContain('Offer a');
      expect((await request(app).post(url).set('X-Forwarded-For', '10.82.0.2').send({})).status).toBe(401);
      expect(await snapshot(ids)).toEqual(before);
    });

    it('6. racing the completion: one transition, one history entry, one audit entry, the money booked once', async () => {
      for (let i = 0; i < 4; i += 1) {
        const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }]);
        const [result, res] = await Promise.all(i % 2 ? [complete(ids), repair(ids)] : [repair(ids), complete(ids)].reverse());
        expect(result.episode_id).toBe(ids.ep);
        // The route ran before the completion (refused) or after it (found it done): never in between.
        expect([200, 409]).toContain(res.status);
        if (res.status === 409) expect(res.body.code).toBe('EPISODE_NOT_COMPLETED');
        else expect(res.body).toEqual(NOTHING);

        const after = await offer(ids.opp.a);
        expect(after.status).toBe('completed');
        expect(after.status_history).toHaveLength(2);
        expect(after.status_history[1]).toMatchObject({ status: 'completed', from: 'booked', route: 'episode_completed' });
        expect(await logs(ids.opp.a, 'opportunity_status')).toHaveLength(1);
        const rows = await ledger(ids);
        expect(rows.filter((r) => r.category === 'appearance_fee')).toEqual([{ category: 'appearance_fee', type: 'income', amount: APPEARANCE }]);
        expect(costs(rows)).toHaveLength(1);
        expect((await episode(ids)).evaluation_status).toBe('accepted');
      }
    });
  });

  // ── Beat 14: the same offer as owner and as the episode's invitation ────

  describe('Beat 14 and the event\'s owner', () => {
    it('an accepted owner that is also this episode\'s beat 14 invitation: completed by the completion, and beat 14\'s step does not write over it', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }]);
      await run('UPDATE opportunities SET offered_in_episode_id = :ep WHERE id = :id', { ep: ids.ep, id: ids.opp.a });
      const result = await complete(ids);
      const after = await offer(ids.opp.a);
      expect(after.status).toBe('completed');
      expect(after.status_history).toHaveLength(2);
      expect(after.status_history[1].route).toBe('episode_completed');
      // Beat 14's step saw it, and reports it as it is.
      expect(result.event_sync?.beat14_opportunity ?? null).toEqual({ id: ids.opp.a, name: 'Offer a', status: 'completed' });
      expect(income(await ledger(ids)).some((r) => r.category === 'appearance_fee')).toBe(true);
    });

    it('a held owner is not accepted: nothing is owed, it is never marked completed, and beat 14 offers or expires it as before', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'held', link: 'owner' }]);
      await run('UPDATE opportunities SET offered_in_episode_id = :ep WHERE id = :id', { ep: ids.ep, id: ids.opp.a });
      await complete(ids);
      expect(income(await ledger(ids))).toEqual([]);
      const after = await offer(ids.opp.a);
      expect(['offered', 'expired']).toContain(after.status);
      expect(after.status_history.some((h) => h.status === 'completed')).toBe(false);
      expect((await episode(ids)).evaluation.compensation).toMatchObject({ owed: false, reason: 'owner_not_accepted' });
    });
  });

  // ── Display: proposed is never earnings ─────────────────────────────────

  describe('Episode Money', () => {
    const line = (money, category) => money.lines.find((l) => l.category === category);

    it('before completion, compensation that is not owed is listed as not owed and left out of the projection', async () => {
      const owed = await seed(DEAL, [{ key: 'a', status: 'booked', link: 'owner' }]);
      const not = await seed(DEAL, [{ key: 'a', status: 'declined', link: 'owner' }]);
      const a = await getEpisodeMoney(sequelize, { showId: owed.show, episodeId: owed.ep });
      const b = await getEpisodeMoney(sequelize, { showId: not.show, episodeId: not.ep });
      expect(line(a, 'appearance_fee')).toMatchObject({ state: 'planned', amount: APPEARANCE });
      expect(line(b, 'appearance_fee')).toMatchObject({ state: 'not_owed', amount: APPEARANCE, not_owed_reason: 'owner_closed' });
      expect(line(b, 'content_fee')).toMatchObject({ state: 'not_owed', not_owed_reason: 'owner_closed' });
      // Her cost is planned either way.
      expect(line(a, 'event_cost').state).toBe('planned');
      expect(line(b, 'event_cost').state).toBe('planned');
      // The paid twin plans its income; the other plans only the cost.
      expect(b.projection.planned_net + b.projection.pending_net).toBe(-COST);
      expect(a.projection.planned_net + a.projection.pending_net).toBe(APPEARANCE + FEE - COST);
      // No bonus is dangled either.
      expect(b.projection.conditional).toEqual([]);
    });

    it('after a completion that withheld it, the lines read not owed, and stay so if the offer is accepted later', async () => {
      const ids = await seed(DEAL, [{ key: 'a', status: 'negotiating', link: 'owner' }]);
      await complete(ids);
      await as(request(app).post(`/api/v1/opportunities/${ids.show}/${ids.opp.a}/advance`)).send({ to_status: 'booked' });
      const money = await getEpisodeMoney(sequelize, { showId: ids.show, episodeId: ids.ep });
      expect(line(money, 'appearance_fee')).toMatchObject({ state: 'not_owed', posted: null });
      expect(line(money, 'event_cost').state).toBe('posted');
      expect(money.projection.planned_net).toBe(0);
    });
  });
});
