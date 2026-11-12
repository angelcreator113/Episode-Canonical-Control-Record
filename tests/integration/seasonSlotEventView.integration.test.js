/**
 * The event a season slot shows is derived on read (Evoni, 2026-11-12;
 * services/seasonLoader slotEventView).
 *
 *   empty slot                      its stored pencilled event
 *   occupied slot                   its episode's canonical event (utils/episodeEventSql)
 *   occupied, episode has no event  no primary event
 *   the association disagrees       needs_review, with its reasons
 *   a pencil that is not the
 *   episode's event                 kept as it is, and flagged
 *
 * Nothing is written: season_slots.event_id (the pencil) is never changed by
 * a read, and the roadmap still sends it as slot.event beside the derived
 * slot.event_view. The first test is Episode 1's exact shape in production:
 * slot 1 holds the episode, is locked and not accepted, and stores no event,
 * while the episode's brief names a live event whose own link points at it.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { loadSeason, slotEventView } = require('../../src/services/seasonLoader');
const { getRoadmap } = require('../../src/services/seasonSlotService');
const { loadCoverageInputs } = require('../../src/services/seasonGoalCoverage');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

describe('slotEventView, pure', () => {
  const base = { id: 's1', event_id: null, live_event_id: null, live_episode_id: null };
  test('an empty slot shows its pencil, or nothing', () => {
    expect(slotEventView({ ...base, event_id: 'ev-1', live_event_id: 'ev-1', event_name: 'Gala', event_status: 'ready' })).toEqual({
      event: { id: 'ev-1', name: 'Gala', status: 'ready' }, source: 'pencil', pencilled_event: { id: 'ev-1', name: 'Gala', status: 'ready' },
      needs_review: false, review_reasons: [], pencil_disagrees: false,
    });
    expect(slotEventView(base)).toMatchObject({ event: null, source: 'none', pencilled_event: null, needs_review: false, pencil_disagrees: false });
  });
  test('an occupied slot shows its episode\'s event, whatever the pencil stores', () => {
    const occupied = { ...base, live_episode_id: 'ep-1', primary_event_id: 'ev-9', primary_event_name: 'Studio Session', primary_event_status: 'used', primary_event_linked_here: true, other_linked_events: '0' };
    expect(slotEventView(occupied)).toEqual({
      event: { id: 'ev-9', name: 'Studio Session', status: 'used' }, source: 'episode', pencilled_event: null,
      needs_review: false, review_reasons: [], pencil_disagrees: false,
    });
    // The same event pencilled: no disagreement.
    expect(slotEventView({ ...occupied, event_id: 'ev-9', live_event_id: 'ev-9', event_name: 'Studio Session' }).pencil_disagrees).toBe(false);
  });
  test('occupied with no primary event: none, and not a review by itself', () => {
    expect(slotEventView({ ...base, live_episode_id: 'ep-1', other_linked_events: '0' })).toMatchObject({ event: null, source: 'none', needs_review: false, pencil_disagrees: false });
  });
});

(shouldSkip ? describe.skip : describe)('the season\'s slots, read', () => {
  const shows = [];

  async function season() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :n, :n, '{}'::jsonb, NOW(), NOW())`, { show, n: `slotview-${show.slice(0, 8)}` });
    const arc = uuid();
    await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end,
                 phases, current_phase, status, narrative_debt, progression_log, emotional_temperature, created_at, updated_at)
               VALUES (:arc, :show, 1, 'Season 1', 1, 1, 6, CAST(:phases AS jsonb), 1, 'active', '[]', '[]', 'rising', NOW(), NOW())`,
    { arc, show, phases: JSON.stringify([{ phase: 1, title: 'Foundation', episode_start: 1, episode_end: 6 }]) });
    return { show, arc };
  }
  async function addEvent(show, name, episodeId = null) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', :status, 3, 5, 0, :episodeId, '{}'::jsonb, NOW(), NOW())`, { id, show, name, episodeId, status: episodeId ? 'used' : 'ready' });
    return id;
  }
  async function addEpisode(show, n, briefEventId = null) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:id, :show, :t, :n, 'draft', NOW(), NOW())`, { id, show, t: `Episode ${n}`, n });
    if (briefEventId) {
      await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:b, :id, :show, :ev, 'draft', NOW(), NOW())`, { b: uuid(), id, show, ev: briefEventId });
    }
    return id;
  }
  async function addSlot(s, n, { episode = null, event = null, locked = false } = {}) {
    const id = uuid();
    await run(`INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, episode_id, event_id, locked_at, created_at, updated_at)
               VALUES (:id, :show, :arc, 1, :n, 1, :episode, :event, ${locked ? 'NOW()' : 'NULL'}, NOW(), NOW())`, { id, show: s.show, arc: s.arc, n, episode, event });
    return id;
  }
  /** The slot as the Roadmap sends it (GET season roadmap → seasonSlotService.getRoadmap). */
  const slotOf = async (s, n) => {
    const roadmap = await getRoadmap(sequelize, s.show);
    const slot = roadmap.phases.flatMap((p) => p.slots).find((x) => x.slot_number === n);
    if (!slot) throw new Error(`slot ${n} is not on the roadmap`);
    return slot;
  };
  const storedPencil = async (id) => (await rows('SELECT event_id, updated_at FROM season_slots WHERE id = :id', { id }))[0];

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { shows } }).catch(() => {});
    if (shows.length) {
      await q('DELETE FROM season_slots WHERE show_id IN (:shows)');
      await q('DELETE FROM episode_briefs WHERE show_id IN (:shows)');
      await q('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id IN (:shows)');
      await q('DELETE FROM episodes WHERE show_id IN (:shows)');
      await q('DELETE FROM world_events WHERE show_id IN (:shows)');
      await q('DELETE FROM show_arcs WHERE show_id IN (:shows)');
      await q('DELETE FROM shows WHERE id IN (:shows)');
    }
    await sequelize.close();
  });

  test('Episode 1\'s exact shape: slot 1 holds the episode, locked, not accepted, stores NO event; it shows the episode\'s event, and the stored slot is not written', async () => {
    const s = await season();
    const episode = await addEpisode(s.show, 1);
    const event = await addEvent(s.show, 'Wearable Experiments Studio Session', episode);
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:b, :episode, :show, :event, 'draft', NOW(), NOW())`, { b: uuid(), episode, show: s.show, event });
    const slotId = await addSlot(s, 1, { episode, event: null, locked: true });
    const before = await storedPencil(slotId);
    expect(before.event_id).toBeNull();

    const slot = await slotOf(s, 1);
    // Raw: the slot stores no pencil, exactly as before.
    expect(slot.event).toBeNull();
    // Derived: the episode's canonical event, with nothing to review.
    expect(slot.event_view).toEqual({
      event: { id: event, name: 'Wearable Experiments Studio Session', status: 'used' },
      source: 'episode', pencilled_event: null, needs_review: false, review_reasons: [], pencil_disagrees: false,
    });
    // Reading wrote nothing: no backfill, the pencil is still NULL and the row untouched.
    expect(await storedPencil(slotId)).toEqual(before);

    // Goal coverage reads the same event for the slot.
    const coverage = await loadCoverageInputs(sequelize, s.show);
    expect(coverage.slots.find((x) => x.slot_number === 1).event.id).toBe(event);
  });

  test('empty future slots: a pencilled one shows its pencil; one with nothing shows nothing; neither is reviewed', async () => {
    const s = await season();
    const pencilled = await addEvent(s.show, 'Charity Gala');
    const slotId = await addSlot(s, 2, { event: pencilled });
    await addSlot(s, 3);
    const two = await slotOf(s, 2);
    expect(two.event).toEqual({ id: pencilled, name: 'Charity Gala', status: 'ready' });
    expect(two.event_view).toEqual({
      event: { id: pencilled, name: 'Charity Gala', status: 'ready' }, source: 'pencil',
      pencilled_event: { id: pencilled, name: 'Charity Gala', status: 'ready' }, needs_review: false, review_reasons: [], pencil_disagrees: false,
    });
    expect((await slotOf(s, 3)).event_view).toMatchObject({ event: null, source: 'none', pencilled_event: null, needs_review: false, pencil_disagrees: false });
    expect((await storedPencil(slotId)).event_id).toBe(pencilled);
    const coverage = await loadCoverageInputs(sequelize, s.show);
    expect(coverage.slots.find((x) => x.slot_number === 2).event.id).toBe(pencilled);
    expect(coverage.slots.find((x) => x.slot_number === 3).event).toBeNull();
  });

  test('an occupied slot whose episode has no event: no primary event, and the pencil is not used in its place', async () => {
    const s = await season();
    const episode = await addEpisode(s.show, 1);
    await addSlot(s, 1, { episode, locked: true });
    expect((await slotOf(s, 1)).event_view).toMatchObject({ event: null, source: 'none', needs_review: false, pencil_disagrees: false });

    const t = await season();
    const eventless = await addEpisode(t.show, 1);
    const stale = await addEvent(t.show, 'Pencilled Before');
    const slotId = await addSlot(t, 1, { episode: eventless, event: stale, locked: true });
    const view = (await slotOf(t, 1)).event_view;
    expect(view).toMatchObject({ event: null, source: 'none', pencil_disagrees: true, pencilled_event: { id: stale, name: 'Pencilled Before' } });
    expect((await storedPencil(slotId)).event_id).toBe(stale);
    // Goal coverage does not count the stale pencil for a started slot.
    const coverage = await loadCoverageInputs(sequelize, t.show);
    expect(coverage.slots.find((x) => x.slot_number === 1).event).toBeNull();
  });

  test('a stored pencil that is not the episode\'s event: the episode\'s event is shown, the pencil is kept and flagged', async () => {
    const s = await season();
    const episode = await addEpisode(s.show, 1);
    const actual = await addEvent(s.show, 'Actual Event', episode);
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:b, :episode, :show, :actual, 'draft', NOW(), NOW())`, { b: uuid(), episode, show: s.show, actual });
    const pencil = await addEvent(s.show, 'Pencilled Event');
    const slotId = await addSlot(s, 1, { episode, event: pencil, locked: true });
    const slot = await slotOf(s, 1);
    expect(slot.event).toMatchObject({ id: pencil });
    expect(slot.event_view).toMatchObject({
      event: { id: actual, name: 'Actual Event' }, source: 'episode', pencil_disagrees: true,
      pencilled_event: { id: pencil, name: 'Pencilled Event' }, needs_review: false,
    });
    expect((await storedPencil(slotId)).event_id).toBe(pencil);
  });

  test('needs review: the event\'s own link is missing; it points at another episode; another event is linked as well', async () => {
    const s = await season();
    const first = await addEvent(s.show, 'Brief Event');
    const episode = await addEpisode(s.show, 1, first);
    await addSlot(s, 1, { episode, locked: true });
    expect((await slotOf(s, 1)).event_view).toMatchObject({ event: { id: first }, needs_review: true, review_reasons: ['primary_link_missing'] });

    const stray = await addEvent(s.show, 'Left By A Reassign', episode);
    expect((await slotOf(s, 1)).event_view).toMatchObject({ event: { id: first }, needs_review: true, review_reasons: ['primary_link_missing', 'other_event_linked'] });
    expect(stray).toBeTruthy();

    const t = await season();
    const other = await addEpisode(t.show, 2);
    const moved = await addEvent(t.show, 'Linked Elsewhere', other);
    const here = await addEpisode(t.show, 1, moved);
    await addSlot(t, 1, { episode: here, locked: true });
    expect((await slotOf(t, 1)).event_view).toMatchObject({ event: { id: moved }, needs_review: true, review_reasons: ['primary_linked_elsewhere'] });
  });

  test('a two-parter is not a review: Part 2\'s event is linked to Part 1, whose brief names it too', async () => {
    const s = await season();
    const part1 = await addEpisode(s.show, 1);
    const event = await addEvent(s.show, 'The Finale', part1);
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:b, :part1, :show, :event, 'draft', NOW(), NOW())`, { b: uuid(), part1, show: s.show, event });
    const part2 = await addEpisode(s.show, 2, event);
    await addSlot(s, 1, { episode: part1, event, locked: true });
    await addSlot(s, 2, { episode: part2, event, locked: true });
    for (const n of [1, 2]) {
      expect((await slotOf(s, n)).event_view).toMatchObject({ event: { id: event }, source: 'episode', needs_review: false, review_reasons: [], pencil_disagrees: false });
    }
  });

  test('a locked read (an edit) returns the same rows and the raw pencil columns the writers read', async () => {
    const s = await season();
    const pencilled = await addEvent(s.show, 'Pencil');
    await addSlot(s, 4, { event: pencilled });
    await sequelize.transaction(async (transaction) => {
      const locked = await loadSeason(sequelize, s.show, { transaction, lock: true });
      const row = locked.slots.find((r) => r.slot_number === 4);
      expect(row).toMatchObject({ event_id: pencilled, live_event_id: pencilled, event_name: 'Pencil', primary_event_id: null });
    });
  });
});
