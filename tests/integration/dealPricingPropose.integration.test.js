/**
 * Propose terms (deal build PR 3, Task #2341; DEAL_DESIGN.md §3.2, §11.1,
 * §12). Evoni's Deal PR 3 ruling (2026-09-30, EVENT_EPISODE_FLOW.md
 * §8(cc)); each test names the point it holds.
 *
 * Through the real routes and the rate card the migrations seeded (version
 * 1 from PR 1, version 2 adding the D15 formats): the proposal is written onto the deal as a draft (rule 14), each
 * component in its own column; Evoni's edits go through the event and
 * deliverable PUTs; Start Episode refuses while a price is missing; after
 * the terms lock the route refuses.
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
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM episode_briefs WHERE show_id = :show`, { show });
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seed({ dealType, tier, appearanceRequired = false, deliverables = [] }) {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Pricing ${ids.show.slice(0, 8)}`, slug: `pricing-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, deal_type, career_tier, appearance_required, status, created_at, updated_at)
               VALUES (:event, :show, 'Velour Launch', 'invite', :dealType, :tier, :appearanceRequired, 'ready', NOW(), NOW())`,
    { ...ids, dealType, tier, appearanceRequired });
    ids.d = {};
    for (const d of deliverables) {
      const res = await auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables`)).send(d);
      expect(res.status).toBe(201);
      ids.d[d.deliverable_type] = res.body.deliverable.id;
    }
    return ids;
  }

  const propose = (ids, body = {}) => auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/propose-terms`)).send(body);
  const putEvent = (ids, body) => auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}`)).send(body);
  const putDeliverable = (ids, type, body) => auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${ids.d[type]}`)).send(body);
  const startEpisode = (ids) => auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/generate-episode`)).send({});
  const components = (ids) => q(`SELECT appearance_fee, partnership_base_fee, performance_fee, pricing_version FROM world_events WHERE id = :event`, ids).then((r) => r[0]);

  it('the rate card is readable: version 2, v1 plus the D15 formats (ruling 5: the tables are data)', async () => {
    const res = await auth(request(app).get('/api/v1/deal-rates'));
    expect(res.status).toBe(200);
    expect(res.body.card.version).toBe(2);
    // 20261001160000-add-deliverable-formats.js: the formats at D15's
    // proportions of the Reel anchor (answer 8's Instagram post at 0.5×).
    expect(res.body.card.anchors.instagram_post).toEqual({ 1: 40, 2: 65, 3: 115, 4: 165, 5: 225 });
    expect(res.body.card.anchors.go_live).toEqual({ 1: 115, 2: 190, 3: 340, 4: 490, 5: 675 });
    expect(res.body.card.anchors.paid_appearance).toEqual({ 1: 150, 2: 250, 3: 450, 4: 650, 5: 900 });
    expect(res.body.card.premiums.paid_ad).toEqual({ whitelisting: null });
  });

  it('writes the proposal onto the deal as a draft, with premiums on one line only (rulings 2 and 3)', async () => {
    const ids = await seed({ dealType: 'appearance_plus_deliverables', tier: 3, deliverables: [
      { description: 'One reel in the coat', deliverable_type: 'instagram_reel', owed_to: 'brand' },
      { description: 'A feed post', deliverable_type: 'instagram_post', owed_to: 'brand' },
    ] });
    const res = await propose(ids, { premiums: { deliverables: { [ids.d.instagram_reel]: [{ kind: 'rush', key: '24h' }] } } });
    expect(res.status).toBe(200);
    expect(res.body.proposal).toMatchObject({ ok: true, pricing_version: 2, career_tier: 3 });
    // D15: the Instagram post has its anchor on card v2 (answer 8): 115 at tier 3.
    expect(res.body.proposal.gaps).toEqual([]);

    expect(await components(ids)).toEqual({ appearance_fee: 450, partnership_base_fee: null, performance_fee: null, pricing_version: 2 });
    const [event] = await q(`SELECT canon_consequences FROM world_events WHERE id = :event`, ids);
    const automation = asJson(event.canon_consequences).automation;
    expect(automation.auto_drafted).toMatchObject({ appearance_fee: 'pricing', deliverable_fees: 'pricing' });
    expect(automation.drafted_values.appearance_fee).toBe(450);
    expect(automation.drafted_values.deliverable_fees).toEqual({ [ids.d.instagram_reel]: 270, [ids.d.instagram_post]: 115 }); // 225 × 1.20

    const fees = await q(`SELECT deliverable_type, fee FROM event_deliverables WHERE event_id = :event ORDER BY deliverable_type`, ids);
    expect(fees).toEqual([{ deliverable_type: 'instagram_post', fee: 115 }, { deliverable_type: 'instagram_reel', fee: 270 }]);
  });

  it('ruling 1: a brand partnership writes the base to its own column, and the appearance only when required', async () => {
    const without = await seed({ dealType: 'brand_partnership', tier: 2, deliverables: [
      { description: 'Three stories', deliverable_type: 'instagram_stories', owed_to: 'brand' },
    ] });
    expect((await propose(without)).status).toBe(200);
    expect(await components(without)).toEqual({ appearance_fee: null, partnership_base_fee: 500, performance_fee: null, pricing_version: 2 });
    const [story] = await q(`SELECT fee FROM event_deliverables WHERE event_id = :event`, without);
    expect(story.fee).toBe(60);

    const withAppearance = await seed({ dealType: 'brand_partnership', tier: 2, appearanceRequired: true });
    expect((await propose(withAppearance)).status).toBe(200);
    expect(await components(withAppearance)).toEqual({ appearance_fee: 250, partnership_base_fee: 500, performance_fee: null, pricing_version: 2 });

    // appearance_required is set through the event PUT, and only as a boolean.
    expect((await putEvent(without, { appearance_required: true })).status).toBe(200);
    expect((await putEvent(without, { appearance_required: 'yes' })).status).toBe(400);
    expect((await propose(without)).status).toBe(200);
    expect((await components(without)).appearance_fee).toBe(250);
  });

  it('ruling 4: a performance booking writes its own fee', async () => {
    const ids = await seed({ dealType: 'performance_booking', tier: 4 });
    expect((await propose(ids)).status).toBe(200);
    expect(await components(ids)).toEqual({ appearance_fee: null, partnership_base_fee: null, performance_fee: 600, pricing_version: 2 });
  });

  it('Evoni edits the numbers through the event and deliverable PUTs', async () => {
    const ids = await seed({ dealType: 'appearance_plus_deliverables', tier: 1, deliverables: [
      { description: 'A feed post', deliverable_type: 'instagram_post', owed_to: 'brand' },
    ] });
    await propose(ids);
    const put = await putEvent(ids, { appearance_fee: 175, partnership_base_fee: 10, performance_fee: 20, gifted_value: 300 });
    expect(put.status).toBe(200);
    expect(put.body.event).toMatchObject({ appearance_fee: 175, partnership_base_fee: 10, performance_fee: 20, gifted_value: 300 });
    const fee = await putDeliverable(ids, 'instagram_post', { fee: 40 });
    expect(fee.status).toBe(200);
    expect(fee.body.deliverable.fee).toBe(40);

    for (const field of ['appearance_fee', 'partnership_base_fee', 'performance_fee', 'gifted_value']) {
      expect((await putEvent(ids, { [field]: -5 })).status).toBe(400);
    }
    expect((await putDeliverable(ids, 'instagram_post', { fee: 2.5 })).status).toBe(400);
    expect((await putDeliverable(ids, 'instagram_post', { deliverable_type: 'appearance' })).status).toBe(400);
  });

  it('ruling 4: a gifted deal proposes no cash and writes no fee', async () => {
    const ids = await seed({ dealType: 'gifted', tier: 4, deliverables: [{ description: 'Reel', deliverable_type: 'instagram_reel', owed_to: 'brand' }] });
    const res = await propose(ids);
    expect(res.status).toBe(200);
    expect(res.body.proposal).toMatchObject({ cash: false, components: {}, note: 'Gifted: no cash income. Record the gifted value on the deal.' });
    expect(await components(ids)).toEqual({ appearance_fee: null, partnership_base_fee: null, performance_fee: null, pricing_version: 2 });
    const [d] = await q(`SELECT fee FROM event_deliverables WHERE event_id = :event`, ids);
    expect(d.fee).toBeNull();
  });

  it('no deal type, or a paid_ad premium with no percent: 400, nothing written', async () => {
    const none = await seed({ dealType: null, tier: 1 });
    expect((await propose(none)).status).toBe(400);
    const ids = await seed({ dealType: 'paid_appearance', tier: 1 });
    const res = await propose(ids, { premiums: { appearance: [{ kind: 'paid_ad', key: 'whitelisting' }] } });
    expect(res.status).toBe(400);
    expect(await components(ids)).toEqual({ appearance_fee: null, partnership_base_fee: null, performance_fee: null, pricing_version: null });
  });

  it('ruling 6: "Other" is never priced, and Start Episode refuses until it has a price', async () => {
    const ids = await seed({ dealType: 'paid_deliverables', tier: 2, deliverables: [
      { description: 'One reel in the coat', deliverable_type: 'instagram_reel', owed_to: 'brand' },
      { description: 'Host a Q&A', deliverable_type: 'other', owed_to: 'brand' },
    ] });
    const proposal = await propose(ids);
    expect(proposal.status).toBe(200);
    expect(proposal.body.proposal.gaps).toEqual(['"Host a Q&A": price required (Other is never priced automatically).']);

    const refused = await startEpisode(ids);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({
      success: false, code: 'DEAL_PRICE_REQUIRED',
      missing: [{ kind: 'deliverable', key: ids.d.other, label: '"Host a Q&A"' }],
    });
    expect(refused.body.error).toBe('Price required before Start Episode: "Host a Q&A".');
    const [unlinked] = await q(`SELECT used_in_episode_id FROM world_events WHERE id = :event`, ids);
    expect(unlinked.used_in_episode_id).toBeNull();
    expect(await q(`SELECT id FROM episode_briefs WHERE event_id = :event`, ids)).toEqual([]);

    expect((await putDeliverable(ids, 'other', { fee: 80 })).status).toBe(200);
    const started = await startEpisode(ids);
    expect(started.status).toBe(201);
  });

  it('ruling 6: a missing component refuses Start Episode too; a legacy event is never refused', async () => {
    const ids = await seed({ dealType: 'brand_partnership', tier: 1 }); // base not offered at Emerging
    await propose(ids);
    const refused = await startEpisode(ids);
    expect(refused.status).toBe(409);
    expect(refused.body.missing).toEqual([{ kind: 'component', key: 'partnership_base_fee', label: 'Partnership base' }]);

    const legacy = await seed({ dealType: null, tier: 1, deliverables: [{ description: 'Host a Q&A', deliverable_type: 'other', owed_to: 'host' }] });
    expect((await startEpisode(legacy)).status).toBe(201);
  });

  it('ruling 6: a multi-event Start Episode refuses when an extra event\'s price is missing', async () => {
    const anchor = await seed({ dealType: null, tier: 1 });
    const extra = await seed({ dealType: 'paid_deliverables', tier: 2, deliverables: [{ description: 'Host a Q&A', deliverable_type: 'other', owed_to: 'brand' }] });
    await run(`UPDATE world_events SET show_id = :show WHERE id = :event`, { show: anchor.show, event: extra.event });
    const res = await auth(request(app).post(`/api/v1/world/${anchor.show}/events/generate-episode-from-many`))
      .send({ event_ids: [anchor.event, extra.event] });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'DEAL_PRICE_REQUIRED', missing: [{ event_id: extra.event, label: 'Velour Launch: "Host a Q&A"' }] });
    expect(await q(`SELECT id FROM episodes WHERE show_id = :show`, anchor)).toEqual([]);
  });

  it('after the terms lock, proposing is refused and no component can change', async () => {
    const ids = await seed({ dealType: 'brand_partnership', tier: 2, appearanceRequired: true });
    await propose(ids);
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Episode 1', 1, 'draft', NOW(), NOW())`, { ep, show: ids.show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:brief, :ep, :show, :event, 'draft', NOW(), NOW())`,
      { brief: uuid(), ep, show: ids.show, event: ids.event });

    const res = await propose(ids);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
    for (const body of [{ appearance_fee: 999 }, { partnership_base_fee: 999 }, { performance_fee: 999 }, { appearance_required: false }]) {
      const put = await putEvent(ids, body);
      expect(put.status).toBe(409);
    }
    // The same values are not a change.
    expect((await putEvent(ids, { appearance_fee: 250, partnership_base_fee: 500, appearance_required: true })).status).toBe(200);
    expect(await components(ids)).toMatchObject({ appearance_fee: 250, partnership_base_fee: 500 });
  });
});
