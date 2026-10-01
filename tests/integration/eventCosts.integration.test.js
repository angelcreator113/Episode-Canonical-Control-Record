/**
 * Itemised event costs (deal build PR 4, Task #2365; docs/DEAL_DESIGN.md
 * §5, Law 7).
 *
 * Through the real routes and Finalize:
 *   - a deal event's costs are edited through /costs, each row saying who
 *     pays it; a legacy event refuses them; the rows lock with the terms;
 *   - the entry line is drafted once (rule 14 record), by the Costs button
 *     and once by Propose terms; the extras no longer are (they are event
 *     spending since the event cost split, 2026-09-30;
 *     episodeSpending.integration.test.js);
 *   - Finalize charges a deal event each row Lala pays, never a comped row,
 *     and neither cost_coins nor styling_extras; a legacy event is charged
 *     as before;
 *   - the forecast shows the same itemised costs, and the extras estimate
 *     as event spending.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { finalizeEpisodeFinancials } = require('../../src/services/financialTransactionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

(shouldSkip ? describe.skip : describe)('Itemised event costs (Task #2365)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-costs', email: 'test@costs.dev', name: 'Costs Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
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
      await run(`DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM episode_briefs WHERE show_id = :show`, { show }).catch((err) => console.error('cleanup briefs:', err.message));
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  // A prestige-8 gala: drinks 100, valet 55, photo booth 150 by
  // EVENT_EXTRAS, and cost_coins 100. dealType null makes a legacy event.
  async function seed({ dealType = 'paid_appearance', tier = 1 } = {}) {
    const ids = { show: uuid(), event: uuid(), ep: uuid(), state: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Costs ${ids.show.slice(0, 8)}`, slug: `costs-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, format, deal_type, career_tier, cost_coins,
                 is_paid, payment_amount, prestige, status, created_at, updated_at)
               VALUES (:event, :show, 'Velour Gala', 'invite', 'gala', :dealType, :tier, 100, false, 0, 8, 'ready', NOW(), NOW())`,
    { ...ids, dealType, tier });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:state, :show, 'lala', 5000, 3, 3, 3, 2, NOW(), NOW())`, ids);
    return ids;
  }

  // Starts the episode the plain way: a live episode the event points at.
  async function startEpisode(ids) {
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Costs episode', 1, 'draft', NOW(), NOW())`, ids);
    await run(`UPDATE world_events SET used_in_episode_id = :ep, status = 'used' WHERE id = :event`, ids);
  }

  const costsUrl = (ids) => `/api/v1/world/${ids.show}/events/${ids.event}/costs`;
  const addCost = (ids, body) => auth(request(app).post(costsUrl(ids))).send(body);
  const listCosts = (ids) => auth(request(app).get(costsUrl(ids)));
  const draftExtras = (ids) => auth(request(app).post(`${costsUrl(ids)}/draft-extras`)).send({});
  const ledger = (ids) => q(
    `SELECT category, amount::float AS amount, source_type, source_id, metadata FROM financial_transactions
      WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY category, amount`, ids);

  it('adds, edits and removes a deal event\'s costs, and validates them', async () => {
    const ids = await seed();

    const added = await addCost(ids, { kind: 'travel', label: 'Car to the venue', amount: 80 });
    expect(added.status).toBe(201);
    expect(added.body.cost).toMatchObject({ kind: 'travel', label: 'Car to the venue', amount: 80, paid_by: 'lala' });

    const edited = await auth(request(app).put(`${costsUrl(ids)}/${added.body.cost.id}`)).send({ paid_by: 'host', amount: 95 });
    expect(edited.status).toBe(200);
    expect(edited.body.cost).toMatchObject({ amount: 95, paid_by: 'host' });

    expect((await addCost(ids, { kind: 'limo', amount: 5 })).status).toBe(400);
    expect((await addCost(ids, { kind: 'glam', amount: -1 })).status).toBe(400);
    expect((await addCost(ids, { kind: 'glam', amount: 1.5 })).status).toBe(400);
    expect((await addCost(ids, { kind: 'glam', amount: 10, paid_by: 'friend' })).status).toBe(400);

    const removed = await auth(request(app).delete(`${costsUrl(ids)}/${added.body.cost.id}`));
    expect(removed.status).toBe(200);
    const list = await listCosts(ids);
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ costs: [], deal: true, locked: false });
  });

  it('a legacy event (no deal type) refuses costs; it is charged its entry cost instead', async () => {
    const ids = await seed({ dealType: null });
    const res = await addCost(ids, { kind: 'travel', amount: 80 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EVENT_NOT_A_DEAL');
    expect((await listCosts(ids)).body).toMatchObject({ costs: [], deal: false });
  });

  it('drafts the entry line once, recorded as drafted (rule 14); no extras since the split', async () => {
    // A paid appearance drafts no entry line (answer 2), and no extras now.
    const paid = await seed();
    const none = await draftExtras(paid);
    expect(none.status).toBe(200);
    expect(none.body.costs).toEqual([]);

    const ids = await seed({ dealType: 'self_funded' });
    const first = await draftExtras(ids);
    expect(first.body.costs.map((c) => [c.kind, c.label, c.amount, c.paid_by])).toEqual([['entry', 'Entry / ticket', 100, 'lala']]);
    const [event] = await q(`SELECT canon_consequences FROM world_events WHERE id = :event`, ids);
    const automation = asJson(event.canon_consequences).automation;
    expect(automation.auto_drafted.costs).toBe('extras');
    expect(Object.values(automation.drafted_values.costs).map((v) => v.key)).toEqual(['entry']);

    // Again: nothing new. After the drafted row is removed, the button drafts it back.
    expect((await draftExtras(ids)).body.drafted).toEqual([]);
    await auth(request(app).delete(`${costsUrl(ids)}/${first.body.costs[0].id}`));
    const again = await draftExtras(ids);
    expect(again.body.drafted.map((c) => c.label)).toEqual(['Entry / ticket']);
  });

  it('answer 2: a self-funded deal drafts an Entry / ticket line Lala pays at the event cost; a comped deal, comped by the host', async () => {
    const selfFunded = await seed({ dealType: 'self_funded' });
    const res = await draftExtras(selfFunded);
    expect(res.status).toBe(200);
    expect(res.body.costs.map((c) => [c.kind, c.label, c.amount, c.paid_by])).toEqual([
      ['entry', 'Entry / ticket', 100, 'lala'],
    ]);
    const [event] = await q(`SELECT canon_consequences FROM world_events WHERE id = :event`, selfFunded);
    const records = Object.values(asJson(event.canon_consequences).automation.drafted_values.costs);
    expect(records.find((r) => r.key === 'entry')).toEqual({ key: 'entry', amount: 100, source: 'event_cost' });

    const comped = await seed({ dealType: 'invited_comped' });
    const compedRes = await draftExtras(comped);
    expect(compedRes.body.costs[0]).toMatchObject({ kind: 'entry', label: 'Entry / ticket', amount: 100, paid_by: 'host' });

    // Charged at Finalize: the comped entry is not (and an episode with no
    // spending lines is charged nothing for extras).
    await startEpisode(comped);
    await finalizeEpisodeFinancials(comped.ep, comped.show, sequelize);
    expect(await ledger(comped)).toEqual([]);
  });

  it('Propose terms drafts the entry line once, and never re-adds it after Evoni removes it', async () => {
    const ids = await seed({ dealType: 'self_funded', tier: 1 });
    const propose = () => auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/propose-terms`)).send({});
    const res = await propose();
    expect(res.status).toBe(200);
    expect(res.body.costs.map((c) => c.label)).toEqual(['Entry / ticket']);

    for (const c of res.body.costs) await auth(request(app).delete(`${costsUrl(ids)}/${c.id}`));
    const second = await propose();
    expect(second.status).toBe(200);
    expect(second.body.costs).toEqual([]);
  });

  it('the costs lock with the terms (D4)', async () => {
    const ids = await seed();
    const cost = (await addCost(ids, { kind: 'glam', amount: 60 })).body.cost;
    await startEpisode(ids);

    const refused = [
      await addCost(ids, { kind: 'travel', amount: 10 }),
      await auth(request(app).put(`${costsUrl(ids)}/${cost.id}`)).send({ amount: 1 }),
      await auth(request(app).delete(`${costsUrl(ids)}/${cost.id}`)),
      await draftExtras(ids),
    ];
    for (const res of refused) {
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
    }
    expect((await listCosts(ids)).body).toMatchObject({ locked: true, costs: [{ id: cost.id, amount: 60 }] });
  });

  it('Finalize charges a deal event each row Lala pays, and nothing for cost_coins, extras or comped rows', async () => {
    const ids = await seed();
    const travel = (await addCost(ids, { kind: 'travel', label: 'Car', amount: 80 })).body.cost;
    const glam = (await addCost(ids, { kind: 'glam', amount: 120 })).body.cost;
    await addCost(ids, { kind: 'accommodation', label: 'Hotel', amount: 400, paid_by: 'host' });
    await addCost(ids, { kind: 'styling', amount: 90, paid_by: 'brand' });
    await addCost(ids, { kind: 'other', label: 'Nothing owed', amount: 0 });
    await startEpisode(ids);

    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    const rows = await ledger(ids);
    expect(rows.map((r) => [r.category, r.amount])).toEqual([
      ['event_cost', 80],
      ['event_cost', 120],
    ]);
    expect(rows.map((r) => r.source_type)).toEqual(['event_cost', 'event_cost']);
    expect(rows.map((r) => r.source_id).sort()).toEqual([travel.id, glam.id].sort());
    expect(asJson(rows[0].metadata)).toMatchObject({ kind: 'travel', paid_by: 'lala', label: 'Car' });
  });

  it('a legacy event is charged as before: its entry cost and one styling_extras row', async () => {
    const ids = await seed({ dealType: null });
    await startEpisode(ids);
    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    expect((await ledger(ids)).map((r) => [r.category, r.amount])).toEqual([
      ['event_entry', 100],
      ['styling_extras', 305],
    ]);
  });

  it('the forecast shows a deal event\'s itemised costs in place of the entry cost, and the extras as spending', async () => {
    const ids = await seed();
    await addCost(ids, { kind: 'travel', label: 'Car', amount: 80 });
    await addCost(ids, { kind: 'accommodation', label: 'Hotel', amount: 400, paid_by: 'host' });

    const res = await auth(request(app).get(`/api/v1/world/${ids.show}/events/${ids.event}/financial-forecast`));
    expect(res.status).toBe(200);
    const { expenses } = res.body.forecast || res.body;
    expect(expenses).toMatchObject({ event_cost: 0, drinks_est: 100, valet_est: 55, photo_booth_est: 150 });
    expect(expenses.itemised).toMatchObject({ lala_total: 80, comped_total: 400 });
    expect(expenses.itemised.costs).toHaveLength(2);
    expect(expenses.total).toBe(expenses.outfit_retail + expenses.outfit_rentals + 80 + 305);

    // An extras row drafted before the split is the estimate: no double count.
    await addCost(ids, { kind: 'extras', label: 'Drinks', amount: 90 });
    const after = (await auth(request(app).get(`/api/v1/world/${ids.show}/events/${ids.event}/financial-forecast`))).body;
    expect((after.forecast || after).expenses).toMatchObject({ drinks_est: 0, valet_est: 0, photo_booth_est: 0 });
  });
});
