/**
 * POST /api/v1/world/:showId/events/bulk-delete (worldEvents/episodeBatch,
 * 2026-11-04).
 *
 * It used to hard DELETE world_events rows in all three modes, used and
 * linked events included, and swallowed per-id errors. Through the real
 * route (utils/worldEventSafeDelete):
 *   - delete_all keeps used and linked events and soft-deletes the rest;
 *   - a link row that is itself soft-deleted no longer holds its event;
 *   - delete_all_drafts never touches a linked draft or a non-draft;
 *   - a named id that is used is refused and reported, not swallowed;
 *   - links are discovered from the schema (financial_transactions,
 *     deal_price_snapshots, scene_set_looks ...), and a parent with a live
 *     child event or an event made for a live opportunity is kept;
 *   - the route is ADMIN only.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { discoverEventLinkColumns } = require('../../src/utils/worldEventSafeDelete');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('events bulk-delete keeps used and linked events', () => {
  let token;
  let userToken;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-admin-bulkdel', email: 'admin@bulkdel.dev', name: 'BulkDel Admin', groups: ['ADMIN'], role: 'ADMIN',
    }).accessToken;
    userToken = TokenService.generateTokenPair({
      id: 'test-user-bulkdel', email: 'test@bulkdel.dev', name: 'BulkDel Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM deal_price_snapshots WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`UPDATE world_events SET opportunity_id = NULL, parent_event_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM opportunities WHERE show_id = :show`, { show });
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seedEvent(ids, key, name, status = 'ready') {
    ids[key] = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, cost_coins, status, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 5, 0, :status, NOW(), NOW())`,
    { id: ids[key], show: ids.show, name, status });
  }

  async function linkOpportunity(ids, eventKey, { deleted = false } = {}) {
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, event_id, created_at, updated_at, deleted_at)
               VALUES (:id, :show, 'Linked opp', 'brand_deal', :event, NOW(), NOW(), ${deleted ? 'NOW()' : 'NULL'})`,
    { id: uuid(), show: ids.show, event: ids[eventKey] });
  }

  async function seed() {
    const ids = { show: uuid(), ep: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `BulkDel ${ids.show.slice(0, 8)}`, slug: `bulkdel-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Used episode', 1, 'draft', NOW(), NOW())`, ids);

    await seedEvent(ids, 'used', 'Used Gala');
    await run(`UPDATE world_events SET used_in_episode_id = :ep, status = 'used', times_used = 1 WHERE id = :used`, ids);
    await seedEvent(ids, 'oppLinked', 'Opportunity Event');
    await linkOpportunity(ids, 'oppLinked');
    await seedEvent(ids, 'costLinked', 'Costed Event');
    await run(`INSERT INTO event_costs (event_id, kind) VALUES (:costLinked, 'travel')`, ids);
    await seedEvent(ids, 'staleLink', 'Event With Deleted Opportunity');
    await linkOpportunity(ids, 'staleLink', { deleted: true });
    await seedEvent(ids, 'linkedDraft', 'Linked Draft', 'draft');
    await linkOpportunity(ids, 'linkedDraft');
    await seedEvent(ids, 'freeDraft', 'Spare Draft', 'draft');
    await seedEvent(ids, 'freeReady', 'Spare Ready');
    return ids;
  }

  // Links the fixed table list used to miss: a ledger row, a price snapshot,
  // a live child event, and the live opportunity an event was made for.
  async function seedNewLinks(ids) {
    await seedEvent(ids, 'ledgerDraft', 'Ledgered Draft', 'draft');
    await run(`INSERT INTO financial_transactions (id, show_id, event_id, type, category, amount, created_at, updated_at)
               VALUES (:id, :show, :ledgerDraft, 'expense', 'event', 10, NOW(), NOW())`, { ...ids, id: uuid() });
    await seedEvent(ids, 'pricedDraft', 'Priced Draft', 'draft');
    await run(`INSERT INTO deal_price_snapshots (event_id, line_kind, line_key, career_tier, band, total)
               VALUES (:pricedDraft, 'base', 'fee', 1, 'mid', 100)`, ids);
    await seedEvent(ids, 'parent', 'Parent Event', 'draft');
    await seedEvent(ids, 'child', 'Child Event', 'draft');
    await run(`UPDATE world_events SET parent_event_id = :parent WHERE id = :child`, ids);
    ids.opp = uuid();
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, created_at, updated_at)
               VALUES (:opp, :show, 'Source opp', 'brand_deal', NOW(), NOW())`, ids);
    await seedEvent(ids, 'oppMade', 'Event For Opportunity', 'draft');
    await run(`UPDATE world_events SET opportunity_id = :opp WHERE id = :oppMade`, ids);
  }

  const bulkDelete = (ids, body, bearer = token) => request(app).post(`/api/v1/world/${ids.show}/events/bulk-delete`)
    .set('Authorization', `Bearer ${bearer}`).send(body);
  const liveness = async (ids) => Object.fromEntries(
    (await q(`SELECT id, deleted_at FROM world_events WHERE show_id = :show`, ids)).map(r => [r.id, r.deleted_at === null]));

  it('delete_all keeps used and linked events and soft-deletes the rest', async () => {
    const ids = await seed();

    const res = await bulkDelete(ids, { delete_all: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deleted).toBe(3);
    expect(res.body.soft_deleted_ids.sort()).toEqual([ids.staleLink, ids.freeDraft, ids.freeReady].sort());
    expect(res.body.kept).toBe(4);
    const kept = Object.fromEntries(res.body.kept_events.map(e => [e.id, e]));
    expect(kept[ids.used]).toMatchObject({ used: true });
    expect(kept[ids.oppLinked]).toMatchObject({ used: false, linked_by: ['opportunities'] });
    expect(kept[ids.costLinked]).toMatchObject({ used: false, linked_by: ['event_costs'] });
    expect(kept[ids.linkedDraft]).toMatchObject({ used: false, linked_by: ['opportunities'] });

    const live = await liveness(ids);
    expect(Object.keys(live)).toHaveLength(7); // every row is still there
    expect(live[ids.used]).toBe(true);
    expect(live[ids.oppLinked]).toBe(true);
    expect(live[ids.costLinked]).toBe(true);
    expect(live[ids.linkedDraft]).toBe(true);
    expect(live[ids.staleLink]).toBe(false);
    expect(live[ids.freeDraft]).toBe(false);
    expect(live[ids.freeReady]).toBe(false);
  });

  it('delete_all_drafts never touches a linked draft or a non-draft', async () => {
    const ids = await seed();

    const res = await bulkDelete(ids, { delete_all_drafts: true });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(1);
    expect(res.body.soft_deleted_ids).toEqual([ids.freeDraft]);
    expect(res.body.kept_events.map(e => e.id)).toEqual([ids.linkedDraft]);

    const live = await liveness(ids);
    expect(live[ids.freeDraft]).toBe(false);
    for (const key of ['used', 'oppLinked', 'costLinked', 'staleLink', 'linkedDraft', 'freeReady']) {
      expect(live[ids[key]]).toBe(true);
    }
  });

  it('per-id refuses a used event and a linked one, and soft-deletes a free one', async () => {
    const ids = await seed();
    const missing = uuid();

    const res = await bulkDelete(ids, { ids: [ids.used, ids.oppLinked, ids.freeReady, missing, 'not-a-uuid'] });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(1);
    expect(res.body.soft_deleted_ids).toEqual([ids.freeReady]);
    expect(res.body.refused_ids.sort()).toEqual([ids.used, ids.oppLinked].sort());
    expect(res.body.not_found_ids.sort()).toEqual([missing, 'not-a-uuid'].sort());

    const live = await liveness(ids);
    expect(live[ids.used]).toBe(true);
    expect(live[ids.oppLinked]).toBe(true);
    expect(live[ids.freeReady]).toBe(false);
    expect(live[ids.freeDraft]).toBe(true); // not named, untouched
  });

  it('delete_all keeps events linked by a ledger row, a price snapshot, a live child, or a live opportunity', async () => {
    const ids = { show: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `BulkDel ${ids.show.slice(0, 8)}`, slug: `bulkdel-${ids.show.slice(0, 8)}` });
    await seedNewLinks(ids);
    await seedEvent(ids, 'freeDraft', 'Spare Draft', 'draft');

    const res = await bulkDelete(ids, { delete_all: true });
    expect(res.status).toBe(200);
    // The child itself is unlinked and goes; its parent is kept.
    expect(res.body.soft_deleted_ids.sort()).toEqual([ids.child, ids.freeDraft].sort());
    const kept = Object.fromEntries(res.body.kept_events.map(e => [e.id, e]));
    expect(kept[ids.ledgerDraft]).toMatchObject({ used: false, linked_by: ['financial_transactions'] });
    expect(kept[ids.pricedDraft]).toMatchObject({ used: false, linked_by: ['deal_price_snapshots'] });
    expect(kept[ids.parent]).toMatchObject({ used: false, linked_by: ['child_events'] });
    expect(kept[ids.oppMade]).toMatchObject({ used: false, linked_by: ['opportunity'] });

    const live = await liveness(ids);
    for (const key of ['ledgerDraft', 'pricedDraft', 'parent', 'oppMade']) expect(live[ids[key]]).toBe(true);
    expect(live[ids.child]).toBe(false);
    expect(live[ids.freeDraft]).toBe(false);
  });

  it('a soft-deleted opportunity no longer holds the event made for it', async () => {
    const ids = { show: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `BulkDel ${ids.show.slice(0, 8)}`, slug: `bulkdel-${ids.show.slice(0, 8)}` });
    await seedNewLinks(ids);
    await run(`UPDATE opportunities SET deleted_at = NOW() WHERE id = :opp`, ids);

    const res = await bulkDelete(ids, { ids: [ids.oppMade] });
    expect(res.status).toBe(200);
    expect(res.body.soft_deleted_ids).toEqual([ids.oppMade]);
  });

  it('discovers the world-event link columns and leaves out the story calendar', async () => {
    const links = await sequelize.transaction(t => discoverEventLinkColumns(sequelize, t));
    const names = links.map(l => `${l.table}.${l.column}`);
    expect(names).toEqual(expect.arrayContaining([
      'financial_transactions.event_id', 'deal_price_snapshots.event_id', 'scene_set_looks.event_id',
      'episode_spending_lines.event_id', 'episode_todo_lists.event_id', 'feed_moments.event_id',
      'pulse_reveals.event_id', 'stories.event_id', 'camera_roll_moments.event_id', 'pulse_polls.world_event_id',
      'season_slots.event_id', 'season_specials.event_id', 'opportunities.event_id', 'episode_briefs.event_id',
      'feed_posts.event_id', 'event_deliverables.event_id', 'event_costs.event_id',
    ]));
    expect(names).not.toContain('calendar_event_attendees.event_id');
    expect(names).not.toContain('calendar_event_ripples.event_id');
    expect(names.some(n => n.startsWith('world_events.'))).toBe(false);
  });

  it('refuses a non-admin with 403 and deletes nothing', async () => {
    const ids = await seed();
    const res = await bulkDelete(ids, { delete_all: true }, userToken);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
    expect(Object.values(await liveness(ids)).every(Boolean)).toBe(true);
  });

  it('refuses a body with no mode', async () => {
    const ids = await seed();
    const res = await bulkDelete(ids, {});
    expect(res.status).toBe(400);
    expect(Object.values(await liveness(ids)).every(Boolean)).toBe(true);
  });
});
