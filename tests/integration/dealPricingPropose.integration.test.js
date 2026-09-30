/**
 * Propose terms (deal build PR 3, Task #2341; DEAL_DESIGN.md §3.2, §11.1).
 * Through the real routes and the version 1 rate card the PR 1 migration
 * seeded: the proposal is written onto the deal as a draft (rule 14),
 * Evoni's edits go through the event and deliverable PUTs, and after the
 * terms lock the route refuses.
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
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

(shouldSkip ? describe.skip : describe)('Propose terms from the rate card (Task #2341)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-pricing', email: 'test@pricing.dev', name: 'Pricing Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM episode_briefs WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seed({ dealType, tier, deliverables = [] }) {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Pricing ${ids.show.slice(0, 8)}`, slug: `pricing-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, deal_type, career_tier, status, created_at, updated_at)
               VALUES (:event, :show, 'Velour Launch', 'invite', :dealType, :tier, 'ready', NOW(), NOW())`, { ...ids, dealType, tier });
    ids.d = {};
    for (const d of deliverables) {
      const res = await auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables`)).send(d);
      expect(res.status).toBe(201);
      ids.d[d.deliverable_type] = res.body.deliverable.id;
    }
    return ids;
  }

  const propose = (ids, body = {}) => auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/propose-terms`)).send(body);

  it('the rate card is readable: version 1, as seeded', async () => {
    const res = await auth(request(app).get('/api/v1/deal-rates'));
    expect(res.status).toBe(200);
    expect(res.body.card.version).toBe(1);
    expect(res.body.card.anchors.paid_appearance).toEqual({ 1: 150, 2: 250, 3: 450, 4: 650, 5: 900 });
    expect(res.body.card.premiums.paid_ad).toEqual({ whitelisting: null });
  });

  it('writes the proposal onto the deal as a draft, with premiums on one line only', async () => {
    const ids = await seed({ dealType: 'appearance_plus_deliverables', tier: 3, deliverables: [
      { description: 'One reel in the coat', deliverable_type: 'reel', owed_to: 'brand' },
      { description: 'A feed post', deliverable_type: 'post', owed_to: 'brand' },
    ] });
    const res = await propose(ids, { premiums: { deliverables: { [ids.d.reel]: [{ kind: 'rush', key: '24h' }] } } });
    expect(res.status).toBe(200);
    expect(res.body.proposal).toMatchObject({ ok: true, pricing_version: 1, career_tier: 3 });
    expect(res.body.proposal.gaps).toEqual(['"A feed post" has no rate anchor; price it by hand.']);

    const [event] = await q(`SELECT appearance_fee, pricing_version, canon_consequences FROM world_events WHERE id = :event`, ids);
    expect(event).toMatchObject({ appearance_fee: 450, pricing_version: 1 });
    const automation = asJson(event.canon_consequences).automation;
    expect(automation.auto_drafted).toMatchObject({ appearance_fee: 'pricing', deliverable_fees: 'pricing' });
    expect(automation.drafted_values.appearance_fee).toBe(450);
    expect(automation.drafted_values.deliverable_fees).toEqual({ [ids.d.reel]: 270 }); // 225 × 1.20

    const fees = await q(`SELECT deliverable_type, fee FROM event_deliverables WHERE event_id = :event ORDER BY deliverable_type`, ids);
    expect(fees).toEqual([{ deliverable_type: 'post', fee: null }, { deliverable_type: 'reel', fee: 270 }]);
  });

  it('Evoni edits the numbers through the event and deliverable PUTs', async () => {
    const ids = await seed({ dealType: 'appearance_plus_deliverables', tier: 1, deliverables: [
      { description: 'A feed post', deliverable_type: 'post', owed_to: 'brand' },
    ] });
    await propose(ids);
    const put = await auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}`)).send({ appearance_fee: 175 });
    expect(put.status).toBe(200);
    expect(put.body.event.appearance_fee).toBe(175);
    const fee = await auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${ids.d.post}`)).send({ fee: 40 });
    expect(fee.status).toBe(200);
    expect(fee.body.deliverable.fee).toBe(40);

    expect((await auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}`)).send({ appearance_fee: -5 })).status).toBe(400);
    expect((await auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${ids.d.post}`)).send({ fee: 2.5 })).status).toBe(400);
  });

  it('a gifted deal proposes no cash', async () => {
    const ids = await seed({ dealType: 'gifted', tier: 4, deliverables: [{ description: 'Reel', deliverable_type: 'reel', owed_to: 'brand' }] });
    const res = await propose(ids);
    expect(res.status).toBe(200);
    const [event] = await q(`SELECT appearance_fee FROM world_events WHERE id = :event`, ids);
    expect(event.appearance_fee).toBe(0);
    const [d] = await q(`SELECT fee FROM event_deliverables WHERE event_id = :event`, ids);
    expect(d.fee).toBeNull();
  });

  it('no deal type, or a paid_ad premium with no percent: 400, nothing written', async () => {
    const none = await seed({ dealType: null, tier: 1 });
    expect((await propose(none)).status).toBe(400);
    const ids = await seed({ dealType: 'paid_appearance', tier: 1 });
    const res = await propose(ids, { premiums: { appearance: [{ kind: 'paid_ad', key: 'whitelisting' }] } });
    expect(res.status).toBe(400);
    const [event] = await q(`SELECT appearance_fee, pricing_version FROM world_events WHERE id = :event`, ids);
    expect(event).toEqual({ appearance_fee: null, pricing_version: null });
  });

  it('after the terms lock, proposing is refused and the fee cannot change', async () => {
    const ids = await seed({ dealType: 'paid_appearance', tier: 2 });
    await propose(ids);
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Episode 1', 1, 'draft', NOW(), NOW())`, { ep, show: ids.show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:brief, :ep, :show, :event, 'draft', NOW(), NOW())`,
      { brief: uuid(), ep, show: ids.show, event: ids.event });

    const res = await propose(ids);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
    const put = await auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}`)).send({ appearance_fee: 999 });
    expect(put.status).toBe(409);
    const [event] = await q(`SELECT appearance_fee FROM world_events WHERE id = :event`, ids);
    expect(event.appearance_fee).toBe(250);
  });
});
