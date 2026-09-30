/**
 * Propose terms drafts the deal's deliverables (ruling D12, Evoni,
 * 2026-09-30; Task #2395), through the real routes and the version 1 rate
 * card: once, priced from the anchors, recorded as drafted (doctrine rule
 * 14), never re-added after Evoni deletes them, and refused once the terms
 * lock.
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

(shouldSkip ? describe.skip : describe)('Propose terms drafts deliverables (D12, Task #2395)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-d12', email: 'test@d12.dev', name: 'D12 Test', groups: ['USER', 'EDITOR'], role: 'USER',
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

  async function seed({ dealType, tier }) {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `D12 ${ids.show.slice(0, 8)}`, slug: `d12-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, deal_type, career_tier, status, created_at, updated_at)
               VALUES (:event, :show, 'Velour Launch', 'invite', :dealType, :tier, 'ready', NOW(), NOW())`,
    { ...ids, dealType, tier });
    return ids;
  }

  const propose = (ids, body = {}) => auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/propose-terms`)).send(body);
  const deliverablesUrl = (ids) => `/api/v1/world/${ids.show}/events/${ids.event}/deliverables`;
  const rows = (ids) => q(
    `SELECT id, deliverable_type, description, required, owed_to, fee FROM event_deliverables
      WHERE event_id = :event AND deleted_at IS NULL ORDER BY created_at ASC, id ASC`, ids);
  const automationOf = async (ids) => {
    const [e] = await q(`SELECT canon_consequences FROM world_events WHERE id = :event`, ids);
    return asJson(e.canon_consequences)?.automation || {};
  };
  const shape = (list) => list.map((r) => ({ type: r.deliverable_type, required: r.required, owed_to: r.owed_to, fee: r.fee }));

  const cases = [
    ['self_funded', 3, []],
    ['invited_comped', 3, []],
    ['gifted', 3, []],
    ['paid_appearance', 2, [{ type: 'story_set_3', required: false, owed_to: 'host', fee: null }]],
    ['paid_deliverables', 1, [{ type: 'reel', required: true, owed_to: 'host', fee: 75 }]],
    ['paid_deliverables', 3, [
      { type: 'reel', required: true, owed_to: 'host', fee: 225 },
      { type: 'story_set_3', required: true, owed_to: 'host', fee: 110 },
    ]],
    ['paid_deliverables', 5, [
      { type: 'reel', required: true, owed_to: 'host', fee: 450 },
      { type: 'story_set_3', required: true, owed_to: 'host', fee: 225 },
      { type: 'post', required: true, owed_to: 'host', fee: null },
    ]],
    ['appearance_plus_deliverables', 4, [
      { type: 'reel', required: true, owed_to: 'host', fee: 325 },
      { type: 'story_set_3', required: true, owed_to: 'host', fee: 160 },
    ]],
    ['performance_booking', 2, [{ type: 'reel', required: true, owed_to: 'host', fee: 125 }]],
    ['brand_partnership', 2, [
      { type: 'reel', required: true, owed_to: 'brand', fee: 125 },
      { type: 'story_set_3', required: true, owed_to: 'brand', fee: 60 },
    ]],
    ['brand_partnership', 4, [
      { type: 'reel', required: true, owed_to: 'brand', fee: 325 },
      { type: 'story_set_3', required: true, owed_to: 'brand', fee: 160 },
      { type: 'post', required: true, owed_to: 'brand', fee: null },
    ]],
  ];

  it.each(cases)('%s at tier %i drafts the expected deliverables once, priced from the anchors', async (dealType, tier, expected) => {
    const ids = await seed({ dealType, tier });
    const res = await propose(ids);
    expect(res.status).toBe(200);
    const drafted = await rows(ids);
    expect(shape(drafted)).toEqual(expected);
    expect(shape(res.body.deliverables)).toEqual(expected);

    const automation = await automationOf(ids);
    if (expected.length === 0) {
      expect(automation.auto_drafted?.deliverables).toBeUndefined();
      expect(automation.drafted_values?.deliverables).toBeUndefined();
    } else {
      expect(automation.auto_drafted.deliverables).toBe('deal');
      expect(automation.drafted_values.deliverables).toEqual(Object.fromEntries(drafted.map((r) => [
        r.id, { type: r.deliverable_type, fee: r.fee, description: r.description, required: r.required },
      ])));
      // The proposal names the drafted rows by their ids, and a Post's gap.
      expect(res.body.proposal.deliverables.map((l) => l.id)).toEqual(drafted.map((r) => r.id));
      if (expected.some((e) => e.type === 'post')) {
        expect(res.body.proposal.gaps).toContain('"Post": price required (Post is priced by hand).');
      }
    }

    // Re-proposing never duplicates.
    expect((await propose(ids)).status).toBe(200);
    expect(shape(await rows(ids))).toEqual(expected);
  });

  it('never re-adds a drafted row Evoni deleted, even when she deletes them all', async () => {
    const ids = await seed({ dealType: 'paid_deliverables', tier: 3 });
    await propose(ids);
    for (const r of await rows(ids)) {
      expect((await auth(request(app).delete(`${deliverablesUrl(ids)}/${r.id}`))).status).toBe(200);
    }
    expect((await propose(ids)).status).toBe(200);
    expect(await rows(ids)).toEqual([]);
  });

  it('an event that already has deliverables is not drafted', async () => {
    const ids = await seed({ dealType: 'paid_deliverables', tier: 5 });
    const add = await auth(request(app).post(deliverablesUrl(ids))).send({ description: 'Host a Q&A', deliverable_type: 'other' });
    expect(add.status).toBe(201);
    expect((await propose(ids)).status).toBe(200);
    expect(shape(await rows(ids))).toEqual([{ type: 'other', required: true, owed_to: 'host', fee: null }]);
    expect((await automationOf(ids)).auto_drafted?.deliverables).toBeUndefined();
  });

  it('editing a drafted row changes it from its drafted copy (Edited)', async () => {
    const ids = await seed({ dealType: 'brand_partnership', tier: 2 });
    await propose(ids);
    const [reel] = await rows(ids);
    const put = await auth(request(app).put(`${deliverablesUrl(ids)}/${reel.id}`)).send({ fee: 150 });
    expect(put.status).toBe(200);
    const record = (await automationOf(ids)).drafted_values.deliverables[reel.id];
    expect(record).toEqual({ type: 'reel', fee: 125, description: 'Reel', required: true });
    expect(put.body.deliverable.fee).not.toBe(record.fee);
  });

  it('a locked event refuses, and nothing is drafted', async () => {
    const ids = await seed({ dealType: 'paid_deliverables', tier: 3 });
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Episode 1', 1, 'draft', NOW(), NOW())`, { ep, show: ids.show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:brief, :ep, :show, :event, 'draft', NOW(), NOW())`,
      { brief: uuid(), ep, show: ids.show, event: ids.event });
    const res = await propose(ids);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
    expect(await rows(ids)).toEqual([]);
  });
});
