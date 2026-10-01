/**
 * Deal components (ruling D14, Evoni 2026-09-30; answers 1–4;
 * docs/DEAL_COMPONENTS_DESIGN.md §3, §9). Build PR 2.
 *
 * Through the real routes and the migrated database: the backfill from
 * deal_type; the event PUT writing components and their derived deal_type
 * copy (and the pre-D14 form, deal_type alone, writing components); the
 * terms lock covering them; pricing, payouts and the entry line reading
 * the components, including combinations no deal type had.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261001170000-add-world-events-deal-components');
const { completionPayouts } = require('../../src/services/dealPayoutService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

(shouldSkip ? describe.skip : describe)('D14: deal components', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-d14', email: 'test@d14.dev', name: 'D14 Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM episode_briefs WHERE show_id = :show`, { show });
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seed({ dealType = null, tier = 3, appearanceRequired = false, costCoins = 0, cc = null } = {}) {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `D14 ${ids.show.slice(0, 8)}`, slug: `d14-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, deal_type, career_tier, appearance_required, cost_coins,
                 host, host_brand, prestige, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Velour Launch', 'invite', :dealType, :tier, :appearanceRequired, :costCoins,
                 'Celeste Rue', 'Velour', 5, :cc, 'ready', NOW(), NOW())`,
    { ...ids, dealType, tier, appearanceRequired, costCoins, cc: cc ? JSON.stringify(cc) : null });
    return ids;
  }

  const putEvent = (ids, body) => auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}`)).send(body);
  const propose = (ids) => auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/propose-terms`)).send({});
  const draftExtras = (ids) => auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/costs/draft-extras`)).send({});
  const row = (ids) => q(`SELECT * FROM world_events WHERE id = :event`, ids).then((r) => r[0]);

  it('the migration backfills each deal type one-to-one, and carries an Auto-drafted record', async () => {
    const cases = [
      ['self_funded', false, []],
      ['invited_comped', false, ['entry_covered']],
      ['gifted', false, ['gifted_items']],
      ['performance_booking', false, ['paid_for_content', 'performance_fee']],
      ['brand_partnership', true, ['paid_to_appear', 'paid_for_content', 'partnership_base']],
    ];
    const seeded = [];
    for (const [dealType, appearanceRequired] of cases) {
      seeded.push(await seed({
        dealType, appearanceRequired,
        cc: { automation: { auto_drafted: { deal_type: 'rule' }, drafted_values: { deal_type: dealType } } },
      }));
    }
    const legacy = await seed({ dealType: null });
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    for (let i = 0; i < cases.length; i += 1) {
      const r = await row(seeded[i]);
      expect(r.deal_components).toEqual(cases[i][2]);
      const automation = asJson(r.canon_consequences).automation;
      expect(automation.auto_drafted.deal_components).toBe('rule');
      expect(automation.drafted_values.deal_components).toEqual(cases[i][2]);
    }
    expect((await row(legacy)).deal_components).toBeNull();
  });

  it('the event PUT writes the components and their derived deal_type', async () => {
    const ids = await seed({ dealType: 'paid_appearance' });
    const res = await putEvent(ids, { deal_components: ['performance_fee', 'paid_to_appear'] });
    expect(res.status).toBe(200);
    expect(await row(ids)).toMatchObject({
      deal_components: ['paid_to_appear', 'performance_fee'], deal_type: 'performance_booking', appearance_required: false,
    });
    // A retainer (answer 4).
    expect((await putEvent(ids, { deal_components: ['partnership_base'] })).status).toBe(200);
    expect(await row(ids)).toMatchObject({ deal_components: ['partnership_base'], deal_type: 'brand_partnership' });
    // An unknown component is refused.
    const bad = await putEvent(ids, { deal_components: ['vip_lounge'] });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/unknown deal component\(s\): vip_lounge/);
    // null clears the deal (legacy).
    expect((await putEvent(ids, { deal_components: null })).status).toBe(200);
    expect(await row(ids)).toMatchObject({ deal_components: null, deal_type: null });
  });

  it('the pre-D14 form (deal_type, appearance_required) writes the components through the map', async () => {
    const ids = await seed({ dealType: 'self_funded' });
    expect((await putEvent(ids, { deal_type: 'brand_partnership' })).status).toBe(200);
    expect((await row(ids)).deal_components).toEqual(['paid_for_content', 'partnership_base']);
    expect((await putEvent(ids, { appearance_required: true })).status).toBe(200);
    expect((await row(ids)).deal_components).toEqual(['paid_to_appear', 'paid_for_content', 'partnership_base']);
  });

  it('pricing reads the components: a retainer prices its base and pays no content', async () => {
    const ids = await seed({ tier: 3 });
    await putEvent(ids, { deal_components: ['partnership_base'] });
    await auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables`))
      .send({ description: 'One reel', deliverable_type: 'instagram_reel' });
    const res = await propose(ids);
    expect(res.status).toBe(200);
    expect(res.body.proposal).toMatchObject({ ok: true, cash: true, deal_components: ['partnership_base'] });
    expect(res.body.proposal.components.partnership_base.fee).toBe(900);
    expect(res.body.proposal.deliverables[0]).toMatchObject({ fee: null, note: 'Not paid for this deal type.' });
  });

  it('payouts pay each ticked money component once, for a combination no deal type had', async () => {
    const ids = await seed();
    await putEvent(ids, { deal_components: ['paid_to_appear', 'performance_fee'], appearance_fee: 300, performance_fee: 500 });
    const rows = completionPayouts(await row(ids), 'slay');
    // D13 answer 5: a performance fee drafts the suggested bonus, slay 20% of the 800 cash total.
    expect(rows.map((r) => [r.category, r.amount])).toEqual([['performance_fee', 500], ['appearance_fee', 300], ['deal_bonus', 160]]);
    expect(rows[0].metadata.deal_components).toEqual(['paid_to_appear', 'performance_fee']);
  });

  it('the entry line (answer 3): self-funded Lala pays; entry covered is comped; a cash deal drafts none', async () => {
    const entryOf = async (components) => {
      const ids = await seed({ costCoins: 200 });
      expect((await putEvent(ids, { deal_components: components })).status).toBe(200);
      expect((await draftExtras(ids)).status).toBeLessThan(300);
      return q(`SELECT paid_by, amount FROM event_costs WHERE event_id = :event AND kind = 'entry' AND deleted_at IS NULL`, ids);
    };
    expect(await entryOf([])).toEqual([{ paid_by: 'lala', amount: 200 }]);
    expect(await entryOf(['gifted_items', 'entry_covered'])).toEqual([{ paid_by: 'host', amount: 200 }]);
    expect(await entryOf(['paid_to_appear'])).toEqual([]);
  });

  it('the terms lock covers the components', async () => {
    const ids = await seed();
    await putEvent(ids, { deal_components: ['paid_to_appear'] });
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Episode 1', 1, 'draft', NOW(), NOW())`, { ep, show: ids.show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:brief, :ep, :show, :event, 'draft', NOW(), NOW())`,
      { brief: uuid(), ep, show: ids.show, event: ids.event });
    const locked = await putEvent(ids, { deal_components: ['paid_to_appear', 'paid_for_content'] });
    expect(locked.status).toBe(409);
    // The same ticks in another order are no change.
    expect((await putEvent(ids, { deal_components: ['paid_to_appear'], name: 'Velour Launch Night' })).status).toBe(200);
  });

  it('a drafted gifted deal pre-ticks entry covered (answer 1), and records the drafted components', async () => {
    const { syncDraftedDealType } = require('../../src/services/dealTypeDraftService');
    const ids = await seed({ dealType: null });
    await run(`UPDATE world_events SET event_type = 'pr_gifting' WHERE id = :event`, ids);
    const oppId = uuid();
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, created_at, updated_at)
               VALUES (:id, :show, 'Gift box', 'pr_gifting', 'offered', NOW(), NOW())`, { id: oppId, show: ids.show })
      .catch((err) => console.warn('opportunity seed:', err.message));
    await run(`UPDATE world_events SET opportunity_id = :opp WHERE id = :event`, { ...ids, opp: oppId });
    const draft = await syncDraftedDealType(sequelize, ids.event, { initial: true });
    expect(draft).toMatchObject({ deal_type: 'gifted', deal_components: ['gifted_items', 'entry_covered'] });
    const r = await row(ids);
    expect(r).toMatchObject({ deal_type: 'gifted', deal_components: ['gifted_items', 'entry_covered'] });
    expect(asJson(r.canon_consequences).automation.drafted_values.deal_components).toEqual(['gifted_items', 'entry_covered']);
    await run('DELETE FROM opportunities WHERE id = :id', { id: oppId }).catch((err) => console.warn('opportunity cleanup:', err.message));
  });
});
