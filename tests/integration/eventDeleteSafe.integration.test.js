/**
 * DELETE /api/v1/world/:showId/events/:eventId (worldEvents/update;
 * Evoni, 2026-11-12: Phase 1, Production Data Safety, PR 1).
 *
 * The route soft-deleted any event, an episode's source included. It now
 * goes through utils/worldEventSafeDelete, the rule bulk delete uses:
 *   - an unused draft is deleted with its own untouched preparation (cost
 *     lines; deliverables no episode or post is tied to), in one transaction;
 *   - an event anything independent uses is kept: 409 EVENT_IN_USE, with
 *     blocked_by saying what holds it and a link only inside this show;
 *   - ADMIN only; 404 for an unknown, deleted or other show's event;
 *   - bulk delete is unchanged: a cost line still holds an event there.
 *
 * Deletion and the writers that point something at an event take turns on
 * the event's row lock, in both orders: a pencil, Start Episode, inject and
 * a multi-event Start never link a deleted event, and a delete that waited
 * for one of them sees what it did.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { seedArc } = require('../../src/services/arcProgressionService');
const { pencilEventIn } = require('../../src/services/seasonSlotService');
const { softDeleteUnusedUnlinkedEvents } = require('../../src/utils/worldEventSafeDelete');
const { lockLiveEvent, EVENT_DELETED_CODE } = require('../../src/utils/eventEpisodeLink');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(shouldSkip ? describe.skip : describe)('deleting one event: safe, and never against a pencil or a Start', () => {
  jest.setTimeout(60000);
  const shows = [];
  let admin;
  let editor;
  const as = (token, r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(() => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-evdel', email: 'admin@evdel.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-user-evdel', email: 'user@evdel.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      const ev = '(SELECT id FROM world_events WHERE show_id = :show)';
      await run(`DELETE FROM deliverable_posts WHERE deliverable_id IN (SELECT id FROM event_deliverables WHERE event_id IN ${ev})`, { show });
      await run('DELETE FROM feed_posts WHERE show_id = :show', { show });
      await run(`DELETE FROM event_deliverables WHERE event_id IN ${ev}`, { show });
      await run(`DELETE FROM event_costs WHERE event_id IN ${ev}`, { show });
      await run(`DELETE FROM deal_price_snapshots WHERE event_id IN ${ev}`, { show });
      await run('DELETE FROM season_specials WHERE show_id = :show', { show });
      await run('DELETE FROM season_slots WHERE show_id = :show', { show });
      await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
      await run('DELETE FROM episode_spending_lines WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episode_briefs WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('UPDATE world_events SET opportunity_id = NULL, parent_event_id = NULL, used_in_episode_id = NULL WHERE show_id = :show', { show });
      await run('DELETE FROM opportunities WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  async function addShow({ season = false } = {}) {
    const show = uuid();
    shows.push(show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show, name: `EvDel ${show.slice(0, 8)}`, slug: `evdel-${show.slice(0, 8)}` });
    const arcId = season ? (await seedArc(show, models)).arc_id : null;
    return { show, arcId };
  }
  async function addEvent(show, name, { status = 'draft', usedIn = null, timesUsed = 0 } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, cost_coins, status, used_in_episode_id, times_used, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 5, 0, :status, :usedIn, :timesUsed, NOW(), NOW())`, { id, show, name, status, usedIn, timesUsed });
    return id;
  }
  async function addEpisode(show, title, { deleted = false } = {}) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at, deleted_at)
               VALUES (:id, :show, :title, 7, 'draft', NOW(), NOW(), ${deleted ? 'NOW()' : 'NULL'})`, { id, show, title });
    return id;
  }
  async function addCost(eventId, label = 'Car') {
    const id = uuid();
    await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, created_at, updated_at) VALUES (:id, :eventId, 'other', :label, 40, NOW(), NOW())`, { id, eventId, label });
    return id;
  }
  async function addDeliverable(eventId, { episodeId = null, status = 'pending' } = {}) {
    const id = uuid();
    await run(`INSERT INTO event_deliverables (id, event_id, description, status, episode_id, created_at, updated_at)
               VALUES (:id, :eventId, 'One reel', :status, :episodeId, NOW(), NOW())`, { id, eventId, status, episodeId });
    return id;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const slotEvent = async (arcId, n) => (await rows('SELECT event_id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].event_id;
  const eventRow = async (id) => (await rows('SELECT id, deleted_at, status, used_in_episode_id FROM world_events WHERE id = :id', { id }))[0];
  const isLive = async (id) => (await eventRow(id)).deleted_at === null;
  const del = (show, eventId, token = admin) => as(token, request(app).delete(`/api/v1/world/${show}/events/${eventId}`));
  const pencil = (show, slot, eventId) => as(admin, request(app).put(`/api/v1/world/${show}/season/slots/${slot}/event`)).send({ event_id: eventId });
  const start = (show, eventId) => as(admin, request(app).post(`/api/v1/world/${show}/events/${eventId}/generate-episode`)).send({ draft_script: false });
  // The delete, held open: its transaction has locked and soft-deleted the event and has not committed.
  async function heldDelete(show, eventId) {
    const transaction = await sequelize.transaction();
    const result = await softDeleteUnusedUnlinkedEvents(sequelize, { showId: show, ids: [eventId], allowOwnedPreparation: true, transaction });
    expect(result.softDeleted.map((e) => e.id)).toEqual([eventId]);
    return transaction;
  }
  // Resolves to true when the request is still waiting after ms (it is behind a lock).
  const stillWaiting = async (pending, ms = 700) => {
    let done = false;
    pending.then(() => { done = true; }, () => { done = true; });
    await wait(ms);
    return !done;
  };

  describe('what is deleted, and what is kept', () => {
    it('an unused draft is soft-deleted with its untouched cost lines and deliverables, and the answer says so', async () => {
      const { show } = await addShow();
      const event = await addEvent(show, 'Loose Draft');
      const other = await addEvent(show, 'Another Draft');
      const cost = await addCost(event);
      const deliverable = await addDeliverable(event);
      const otherCost = await addCost(other, 'Kept');

      const res = await del(show, event);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, deleted: event, also_removed: { deliverables: 1, costs: 1 } });
      expect(res.body.message).toBe('"Loose Draft" was deleted, with its 1 deliverable and 1 cost line. They no longer appear anywhere in the app.');

      // Soft-deleted, never removed: the rows are still there.
      expect((await eventRow(event)).deleted_at).not.toBeNull();
      expect((await rows('SELECT deleted_at FROM event_costs WHERE id = :cost', { cost }))[0].deleted_at).not.toBeNull();
      expect((await rows('SELECT deleted_at FROM event_deliverables WHERE id = :deliverable', { deliverable }))[0].deleted_at).not.toBeNull();
      // Another event and its own preparation are untouched.
      expect(await isLive(other)).toBe(true);
      expect((await rows('SELECT deleted_at FROM event_costs WHERE id = :otherCost', { otherCost }))[0].deleted_at).toBeNull();

    });

    it('a draft with no preparation: deleted, and the message names nothing else', async () => {
      const { show } = await addShow();
      const event = await addEvent(show, 'Bare Draft');
      const res = await del(show, event);
      expect(res.status).toBe(200);
      expect(res.body.also_removed).toEqual({ deliverables: 0, costs: 0 });
      expect(res.body.message).toBe('"Bare Draft" was deleted. It no longer appears anywhere in the app.');
    });

    it('an event a live episode was started from is kept, with a link to that episode', async () => {
      const { show } = await addShow();
      const episode = await addEpisode(show, 'Gala Night');
      const event = await addEvent(show, 'The Gala', { status: 'used', usedIn: episode, timesUsed: 1 });
      await run('INSERT INTO episode_briefs (id, episode_id, event_id, created_at, updated_at) VALUES (:id, :episode, :event, NOW(), NOW())', { id: uuid(), episode, event });
      await addCost(event);

      const res = await del(show, event);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'EVENT_IN_USE', event: { id: event, name: 'The Gala' } });
      // The episode is said once (not again for its brief), with its link.
      expect(res.body.blocked_by).toEqual([
        { kind: 'episode', label: 'Episode 7 "Gala Night" was started from it', link: `/episodes/${episode}`, episode_id: episode },
      ]);
      expect(res.body.error).toBe('"The Gala" can\'t be deleted. Episode 7 "Gala Night" was started from it. Nothing was deleted.');
      expect(await isLive(event)).toBe(true);
      // Its preparation stays with it.
      expect(await rows('SELECT 1 FROM event_costs WHERE event_id = :event AND deleted_at IS NOT NULL', { event })).toEqual([]);
    });

    it('an episode in another show is named without a link or its title', async () => {
      const { show } = await addShow();
      const { show: elsewhere } = await addShow();
      const episode = await addEpisode(elsewhere, 'Private Title');
      const event = await addEvent(show, 'Borrowed', { status: 'used', usedIn: episode, timesUsed: 1 });
      const res = await del(show, event);
      expect(res.status).toBe(409);
      expect(res.body.blocked_by).toEqual([{ kind: 'episode', label: 'An episode in another show was started from it' }]);
      expect(JSON.stringify(res.body)).not.toMatch(/Private Title/);
      expect(JSON.stringify(res.body)).not.toContain(episode);
    });

    it('an event whose episode was deleted is still kept (the strict rule), and the answer says why', async () => {
      const { show } = await addShow();
      const episode = await addEpisode(show, 'Removed', { deleted: true });
      const event = await addEvent(show, 'Once Used', { status: 'used', usedIn: episode, timesUsed: 1 });
      const res = await del(show, event);
      expect(res.status).toBe(409);
      expect(res.body.blocked_by).toEqual([
        { kind: 'episode_deleted', label: 'It was used by an episode that has since been deleted, so it is kept as the record of that episode' },
      ]);
      expect(await isLive(event)).toBe(true);
    });

    it('a pencilled event is kept, and the answer says where in the season plan', async () => {
      const { show, arcId } = await addShow({ season: true });
      const event = await addEvent(show, 'Pencilled');
      expect((await pencil(show, await slotId(arcId, 4), event)).status).toBe(200);
      const res = await del(show, event);
      expect(res.status).toBe(409);
      expect(res.body.blocked_by).toEqual([
        { kind: 'season_slots', label: 'It is in the season plan at S1 · E4', link: `/shows/${show}/season?tab=roadmap` },
      ]);
      expect(await isLive(event)).toBe(true);
      // Cleared from the plan, it can go.
      expect((await pencil(show, await slotId(arcId, 4), null)).status).toBe(200);
      expect((await del(show, event)).status).toBe(200);
    });

    it('a deliverable an episode or a post is tied to, or that is no longer pending, keeps its event', async () => {
      const { show } = await addShow();
      const episode = await addEpisode(show, 'Owes A Reel');
      const stamped = await addEvent(show, 'Stamped');
      await addDeliverable(stamped, { episodeId: episode });
      const done = await addEvent(show, 'Done Deliverable');
      await addDeliverable(done, { status: 'completed' });
      const posted = await addEvent(show, 'Posted');
      const deliverable = await addDeliverable(posted);
      const post = uuid();
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle) VALUES (:post, :show, 'lala')`, { post, show });
      await run('INSERT INTO deliverable_posts (deliverable_id, feed_post_id) VALUES (:deliverable, :post)', { deliverable, post });

      for (const event of [stamped, done, posted]) {
        const res = await del(show, event);
        expect(res.status).toBe(409);
        expect(res.body.blocked_by).toEqual([
          { kind: 'event_deliverables', label: 'It has deliverables an episode or a post is already tied to' },
        ]);
        expect(await isLive(event)).toBe(true);
        expect(await rows('SELECT 1 FROM event_deliverables WHERE event_id = :event AND deleted_at IS NOT NULL', { event })).toEqual([]);
      }
    });

    it('an open opportunity and a child event keep their event', async () => {
      const { show } = await addShow();
      const made = await addEvent(show, 'Made For A Deal');
      const opportunity = uuid();
      await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, created_at, updated_at) VALUES (:opportunity, :show, 'Deal', 'brand_deal', NOW(), NOW())`, { opportunity, show });
      await run('UPDATE world_events SET opportunity_id = :opportunity WHERE id = :made', { opportunity, made });
      const parent = await addEvent(show, 'Parent');
      const child = await addEvent(show, 'Child');
      await run('UPDATE world_events SET parent_event_id = :parent WHERE id = :child', { parent, child });

      const a = await del(show, made);
      expect(a.status).toBe(409);
      expect(a.body.blocked_by).toEqual([{ kind: 'opportunity', label: 'The opportunity it was made for is still open' }]);
      const b = await del(show, parent);
      expect(b.status).toBe(409);
      expect(b.body.blocked_by).toEqual([{ kind: 'child_events', label: 'Other events were made from it' }]);
      expect(await isLive(made)).toBe(true);
      expect(await isLive(parent)).toBe(true);
    });

    it('404 for an unknown event, another show\'s event and one already deleted; ADMIN only', async () => {
      const { show } = await addShow();
      const { show: elsewhere } = await addShow();
      const theirs = await addEvent(elsewhere, 'Theirs');
      const mine = await addEvent(show, 'Mine');

      expect((await del(show, uuid())).status).toBe(404);
      expect((await del(show, 'not-a-uuid')).status).toBe(404);
      expect((await del(show, theirs)).status).toBe(404);
      expect(await isLive(theirs)).toBe(true);

      const refused = await del(show, mine, editor);
      expect(refused.status).toBe(403);
      expect(await isLive(mine)).toBe(true);
      expect((await as('', request(app).delete(`/api/v1/world/${show}/events/${mine}`))).status).toBe(401);

      expect((await del(show, mine)).status).toBe(200);
      expect((await del(show, mine)).status).toBe(404);
    });

    it('bulk delete is unchanged: there, a cost line still holds its event', async () => {
      const { show } = await addShow();
      const withCost = await addEvent(show, 'Has A Cost');
      await addCost(withCost);
      const free = await addEvent(show, 'Free');
      const res = await as(admin, request(app).post(`/api/v1/world/${show}/events/bulk-delete`)).send({ ids: [withCost, free] });
      expect(res.status).toBe(200);
      expect(res.body.soft_deleted_ids).toEqual([free]);
      expect(res.body.refused_ids).toEqual([withCost]);
      expect(res.body.kept_events[0].linked_by).toEqual(['event_costs']);
      expect(await rows('SELECT 1 FROM event_costs WHERE event_id = :withCost AND deleted_at IS NOT NULL', { withCost })).toEqual([]);
    });
  });

  describe('a delete and a pencil take turns, in both orders', () => {
    it('the delete first: a pencil that waited for it is refused, and the slot is left as it was', async () => {
      const { show, arcId } = await addShow({ season: true });
      const event = await addEvent(show, 'Going');
      const slot = await slotId(arcId, 3);
      const held = await heldDelete(show, event);
      let pending;
      try {
        pending = pencil(show, slot, event).then((r) => r);
        expect(await stillWaiting(pending)).toBe(true); // behind the delete's lock on the event
        await held.commit();
      } catch (err) { await held.rollback().catch(() => {}); throw err; }
      const res = await pending;
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('SEASON_EVENT_NOT_FOUND');
      expect(await slotEvent(arcId, 3)).toBeNull();
      expect(await isLive(event)).toBe(false);
    });

    it('the pencil first: a delete that waited for it sees the slot and keeps the event', async () => {
      const { show, arcId } = await addShow({ season: true });
      const event = await addEvent(show, 'Staying');
      const slot = await slotId(arcId, 5);
      const transaction = await sequelize.transaction();
      let pending;
      try {
        // The pencil, held open: it has locked the event and written the slot, and has not committed.
        await pencilEventIn(sequelize, show, slot, event, transaction);
        pending = del(show, event).then((r) => r);
        expect(await stillWaiting(pending)).toBe(true); // behind the pencil's lock on the event
        await transaction.commit();
      } catch (err) { await transaction.rollback().catch(() => {}); throw err; }
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_IN_USE');
      expect(res.body.blocked_by).toEqual([
        { kind: 'season_slots', label: 'It is in the season plan at S1 · E5', link: `/shows/${show}/season?tab=roadmap` },
      ]);
      expect(await isLive(event)).toBe(true);
      expect(await slotEvent(arcId, 5)).toBe(event);
    });
  });

  describe('a delete and Start Episode take turns, in both orders', () => {
    it('the delete first: a Start that waited for it is refused, and nothing was created', async () => {
      const { show } = await addShow();
      const event = await addEvent(show, 'Deleted Before Start', { status: 'ready' });
      const held = await heldDelete(show, event);
      let pending;
      try {
        pending = start(show, event).then((r) => r);
        expect(await stillWaiting(pending, 1500)).toBe(true); // behind the delete's lock on the event
        await held.commit();
      } catch (err) { await held.rollback().catch(() => {}); throw err; }
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: EVENT_DELETED_CODE, error: 'This event was deleted. Nothing was started or linked.' });
      expect(await rows('SELECT id FROM episodes WHERE show_id = :show', { show })).toEqual([]);
      expect(await rows('SELECT 1 FROM episode_briefs WHERE event_id = :event', { event })).toEqual([]);
      const after = await eventRow(event);
      expect(after.used_in_episode_id).toBeNull();
      expect(after.status).toBe('ready');
      // Once the delete is committed, a Start does not get as far as the lock.
      expect((await start(show, event)).status).toBe(404);
    });

    it('the Start first: a delete that waited for it sees the episode and keeps the event', async () => {
      const { show } = await addShow();
      const event = await addEvent(show, 'Started First', { status: 'ready' });
      const episode = await addEpisode(show, 'Just Started');
      const transaction = await sequelize.transaction();
      let pending;
      try {
        // Start Episode's own steps on the event, held open: its lock, then its stamp.
        await lockLiveEvent(sequelize, event, { transaction });
        await sequelize.query(
          `UPDATE world_events SET status = 'used', used_in_episode_id = :episode, times_used = 1 WHERE id = :event AND deleted_at IS NULL`,
          { replacements: { episode, event }, transaction });
        pending = del(show, event).then((r) => r);
        expect(await stillWaiting(pending)).toBe(true);
        await transaction.commit();
      } catch (err) { await transaction.rollback().catch(() => {}); throw err; }
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body.blocked_by).toEqual([
        { kind: 'episode', label: 'Episode 7 "Just Started" was started from it', link: `/episodes/${episode}`, episode_id: episode },
      ]);
      expect(await isLive(event)).toBe(true);
    });

    it('a real Start, then a delete: refused with the new episode', async () => {
      const { show } = await addShow();
      const event = await addEvent(show, 'Really Started', { status: 'ready' });
      const started = await start(show, event);
      expect(started.status).toBe(201);
      const res = await del(show, event);
      expect(res.status).toBe(409);
      expect(res.body.blocked_by[0]).toMatchObject({ kind: 'episode', link: `/episodes/${started.body.data.episode.id}` });
      expect(await isLive(event)).toBe(true);
    });

    it('lockLiveEvent refuses a deleted event and an unknown one, and needs a transaction', async () => {
      const { show } = await addShow();
      const event = await addEvent(show, 'Gone');
      expect((await del(show, event)).status).toBe(200);
      await expect(sequelize.transaction((transaction) => lockLiveEvent(sequelize, event, { transaction }))).rejects.toMatchObject({ code: EVENT_DELETED_CODE, status: 409 });
      await expect(sequelize.transaction((transaction) => lockLiveEvent(sequelize, uuid(), { transaction }))).rejects.toMatchObject({ code: EVENT_DELETED_CODE });
      await expect(lockLiveEvent(sequelize, event)).rejects.toThrow(/transaction/);
    });
  });

  describe('a deleted event is never linked by inject or a multi-event Start', () => {
    it('inject: a deleted event is not found, and the episode is not linked', async () => {
      const { show } = await addShow();
      const episode = await addEpisode(show, 'Target');
      const event = await addEvent(show, 'Deleted Then Injected', { status: 'ready' });
      expect((await del(show, event)).status).toBe(200);
      const res = await as(admin, request(app).post(`/api/v1/world/${show}/events/${event}/inject`)).send({ episode_id: episode });
      expect(res.status).toBe(404);
      expect((await eventRow(event)).used_in_episode_id).toBeNull();
    });

    it('multi-event Start: a deleted or foreign event in the list refuses the whole request; nothing is created or dropped silently', async () => {
      const { show } = await addShow();
      const { show: elsewhere } = await addShow();
      const anchor = await addEvent(show, 'Anchor', { status: 'ready' });
      const extra = await addEvent(show, 'Extra', { status: 'ready' });
      const gone = await addEvent(show, 'Gone', { status: 'ready' });
      const theirs = await addEvent(elsewhere, 'Theirs', { status: 'ready' });
      expect((await del(show, gone)).status).toBe(200);

      const many = (ids) => as(admin, request(app).post(`/api/v1/world/${show}/events/generate-episode-from-many`)).send({ event_ids: ids });
      const res = await many([anchor, extra, gone, theirs]);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false, code: 'EVENTS_NOT_FOUND' });
      expect(res.body.missing_event_ids.sort()).toEqual([gone, theirs].sort());
      expect(res.body.error).toMatch(/^2 of the 4 chosen events were deleted or are not in this show\. No episode was created/);
      // Nothing was started from the events that are there.
      expect(await rows('SELECT id FROM episodes WHERE show_id = :show', { show })).toEqual([]);
      expect((await eventRow(anchor)).used_in_episode_id).toBeNull();
      expect((await eventRow(extra)).used_in_episode_id).toBeNull();
      // The deleted event as the anchor: the same answer.
      expect((await many([gone, anchor])).status).toBe(404);
      expect(await rows('SELECT id FROM episodes WHERE show_id = :show', { show })).toEqual([]);
    });

    it('multi-event Start: an extra deleted after the list was checked is not linked, and is named with why', async () => {
      const { show } = await addShow();
      const anchor = await addEvent(show, 'Anchor', { status: 'ready' });
      const extra = await addEvent(show, 'Vanishing Extra', { status: 'ready' });
      // The extra is deleted while the anchor's episode is being created (after the up-front check).
      const generator = require('../../src/services/episodeGeneratorService');
      const real = generator.generateEpisodeFromEvent;
      jest.spyOn(generator, 'generateEpisodeFromEvent').mockImplementation(async (...args) => {
        const result = await real(...args);
        await run('UPDATE world_events SET deleted_at = NOW() WHERE id = :extra', { extra });
        return result;
      });

      const res = await as(admin, request(app).post(`/api/v1/world/${show}/events/generate-episode-from-many`)).send({ event_ids: [anchor, extra] });
      // The anchor's episode stands by itself; the extra is reported, never dropped silently.
      expect(res.status).toBe(201);
      expect(res.body.linked_extras).toEqual([]);
      expect(res.body.skipped_extras).toEqual([{ id: extra, name: 'Vanishing Extra', reason: 'This event was deleted. Nothing was started or linked.' }]);
      const after = await eventRow(extra);
      expect(after.used_in_episode_id).toBeNull();
      expect(after.status).toBe('ready');
      expect((await eventRow(anchor)).used_in_episode_id).toBe(res.body.data.episode.id);
    });
  });

  describe('a full season\'s special on Start', () => {
    it('never points at a deleted event', async () => {
      const { specialOnFullStart } = require('../../src/services/seasonFullSpecials');
      const { show, arcId } = await addShow({ season: true });
      // A full season: every slot holds a live event.
      const slots = await rows('SELECT id FROM season_slots WHERE arc_id = :arcId ORDER BY slot_number', { arcId });
      for (const [i, s] of slots.entries()) {
        const ev = await addEvent(show, `Weekly ${i + 1}`);
        await run('UPDATE season_slots SET event_id = :ev WHERE id = :id', { ev, id: s.id });
      }
      const live = await addEvent(show, 'Extra Live');
      const gone = await addEvent(show, 'Extra Gone');
      const episode = await addEpisode(show, 'Special Episode');
      await run('UPDATE world_events SET deleted_at = NOW() WHERE id = :gone', { gone });

      expect(await specialOnFullStart(sequelize, { showId: show, eventId: gone, episodeId: episode })).toBeNull();
      expect(await rows('SELECT 1 FROM season_specials WHERE show_id = :show', { show })).toEqual([]);
      // The same call with a live event makes the special (the season is full).
      expect(await specialOnFullStart(sequelize, { showId: show, eventId: live, episodeId: episode })).not.toBeNull();
      expect(await rows('SELECT event_id FROM season_specials WHERE show_id = :show', { show })).toEqual([{ event_id: live }]);
    });
  });
});
