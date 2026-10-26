'use strict';

/**
 * Special episodes (Evoni, 2026-10-26: "Seems like sometimes we will have
 * special episodes to keep up with our events what's do you think?" — "All
 * three and on YouTube, show me first"). The weekly Sunday episodes stay the
 * backbone: E1–E24 in season_slots keep their numbers and their dates. Three
 * kinds sit beside them, in season_specials (migration
 * 20261026150000-create-season-specials):
 *
 *   bonus     an event between two Sundays gets its own episode. It sits
 *             after a weekly episode ("Special · after E7"), has its own
 *             release date and time (a Wednesday, say), and moves no weekly
 *             number or date. Its event counts in the goal coverage and Needs
 *             attention like any other, in the part of the episode it follows.
 *   special   a stand-alone special (holiday, recap, reunion) with a title,
 *             after a weekly episode. It shows in Results and the wrap-up;
 *             it counts toward no part and no goal.
 *   two_part  one big event over two weekly slots: "E12 · Part 1/2" and
 *             "E13 · Part 2/2". Part 2 is the next weekly slot, so it keeps
 *             its Sunday. Both slots hold the event.
 *
 * Two-parters happen once (the decision, 2026-10-26):
 *   - Start Episode on the event starts Part 1, the event's episode, as
 *     always: the terms lock, the money plan, the look, the social tasks,
 *     the invitation are all Part 1's ("one event starts one episode" holds).
 *   - "Start Part 2" makes Part 2's episode from Part 1: its own 14-beat
 *     script, the same event on its brief (the script writer reads it), none
 *     of the event's money or tasks again.
 *   - Part 2 completes the event. Completing Part 1 alone is refused ("to be
 *     continued"); completing Part 2 runs the one completion for the event
 *     (on Part 1, which holds the deal, look and money: the evaluation, the
 *     deal payout and the goal movement, once), then marks Part 2 done with
 *     the same result. Both slots read done.
 *
 * Every special episode releases on YouTube like the main show; its date and
 * time are set by hand (the weekly schedule never dates them), and mirror to
 * its episode's air_date once it has one.
 *
 * Before the migration has run the table is not there: every read here is
 * empty (the roadmap and the release schedule read as they always did) and
 * every action refuses politely ("needs its migration first").
 *
 *   specialsReady(sequelize)
 *   roadmapSpecials(sequelize, arc, slots)  { ready, specials, two_parters, twoPartBySlot }
 *   createSpecial / updateSpecial / removeSpecial
 *   createTwoParter / removeTwoParter / startPartTwo
 *   assignSpecialOnStart, recordSpecialOutcome   (Start Episode, completion)
 *   twoPartRole, completeTwoPart                 (completion)
 *   releaseSpecials(sequelize, showId)           (the release schedule)
 *   clearEventFromSpecials, eventsInSpecials     (the weekly pencil)
 *   insertSpecial, takeEvent                     (also services/seasonFullSpecials:
 *                                                 a full season's events become specials)
 * No AI call.
 */

const TABLE = 'season_specials';
const KINDS = Object.freeze(['bonus', 'special']);
const SPECIAL_TYPES = Object.freeze(['holiday', 'recap', 'reunion', 'other']);
const TYPE_LABEL = Object.freeze({ holiday: 'Holiday special', recap: 'Recap special', reunion: 'Reunion special', other: 'Special' });
const MIGRATION_PENDING = 'SEASON_SPECIALS_MIGRATION_PENDING';
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class SpecialsError extends Error {
  constructor(message, status = 409, code = 'SEASON_SPECIAL_REFUSED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ── Is the table there? (information_schema; a yes is kept, a no asked again) ──
const readyBy = new WeakMap();
async function specialsReady(sequelize, { transaction } = {}) {
  if (readyBy.get(sequelize)) return true;
  try {
    const [rows] = await sequelize.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = :table LIMIT 1`,
      { replacements: { table: TABLE }, transaction });
    // A database that answers nothing usable (no rows array) has no table either.
    const ready = Array.isArray(rows) && rows.length > 0;
    if (ready) readyBy.set(sequelize, true);
    return ready;
  } catch (err) {
    console.error('[seasonSpecials] could not tell whether season_specials exists; treated as not yet:', err.message);
    return false;
  }
}

async function assertReady(sequelize, transaction) {
  if (!(await specialsReady(sequelize, { transaction }))) {
    throw new SpecialsError('Special episodes need their migration first (20261026150000-create-season-specials). Run it through the Deploy workflow, then try again.', 409, MIGRATION_PENDING);
  }
}

// ── Labels ────────────────────────────────────────────────────────────────
/** "Special · after E7" (bonus), "Holiday special" (special); "Special · before E1" after 0. */
function specialLabel(sp) {
  if (sp.kind === 'special') return TYPE_LABEL[sp.special_type] || TYPE_LABEL.other;
  const n = Number(sp.after_slot_number) || 0;
  return n > 0 ? `Special · after E${n}` : 'Special · before E1';
}
/** Where it sits, for a stand-alone special too: "after E7". */
const placeText = (sp) => (Number(sp.after_slot_number) > 0 ? `after E${Number(sp.after_slot_number)}` : 'before E1');
/** "E12 · Part 1/2". */
const partLabel = (slotNumber, part) => `E${slotNumber} · Part ${part}/2`;

const dayText = (v) => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  return ISO.test(s) ? s : null;
};

// ── Reads ─────────────────────────────────────────────────────────────────
async function specialRows(sequelize, { arcId = null, showId = null, transaction, lock = false } = {}) {
  const [rows] = await sequelize.query(
    `SELECT sp.*, to_char(sp.release_date, 'YYYY-MM-DD') AS release_day,
            ep.id AS live_episode_id, ep.title AS episode_title, ep.status AS episode_status,
            ep.evaluation_status AS episode_evaluation_status,
            ev.id AS live_event_id, ev.name AS event_name, ev.status AS event_status, ev.event_date, ev.prestige,
            COALESCE(a.season_number, 1) AS season_number
       FROM ${TABLE} sp
       JOIN show_arcs a ON a.id = sp.arc_id AND a.deleted_at IS NULL
       LEFT JOIN episodes ep ON ep.id = sp.episode_id AND ep.deleted_at IS NULL
       LEFT JOIN world_events ev ON ev.id = sp.event_id AND ev.deleted_at IS NULL
      WHERE sp.deleted_at IS NULL AND ${arcId ? 'sp.arc_id = :arcId' : 'sp.show_id = :showId'}
      ORDER BY sp.after_slot_number ASC NULLS LAST, sp.created_at ASC${lock ? ' FOR UPDATE OF sp' : ''}`,
    { replacements: { arcId, showId }, transaction });
  return rows;
}

function stateOf({ episode, event }) {
  const { slotState } = require('./seasonSlotService');
  return slotState({ episode, event });
}

/** One bonus or stand-alone special as the roadmap shows it. */
function specialView(r, slots = []) {
  const episode = r.live_episode_id
    ? { id: r.live_episode_id, title: r.episode_title, status: r.episode_status, evaluation_status: r.episode_evaluation_status }
    : null;
  const event = r.live_event_id ? { id: r.live_event_id, name: r.event_name, status: r.event_status, event_date: r.event_date || null } : null;
  const after = Number(r.after_slot_number) || 0;
  const near = slots.find((s) => Number(s.slot_number) === Math.max(1, after));
  return {
    id: r.id,
    kind: r.kind,
    special_type: r.special_type || null,
    title: r.title || event?.name || episode?.title || null,
    after_slot_number: after,
    label: specialLabel(r),
    place: placeText(r),
    // A bonus counts in the part of the episode it follows; a stand-alone special in none.
    phase: r.kind === 'bonus' ? Number(near?.phase) || 1 : null,
    counts_toward_parts: r.kind === 'bonus',
    state: stateOf({ episode, event }),
    locked: Boolean(r.locked_at) || Boolean(episode),
    episode,
    event,
    release: { date: r.release_day || dayText(r.release_date), time: r.release_time || null },
    result: { actual_outcome: r.actual_outcome || null, actual_pressure: r.actual_pressure || null },
  };
}

/**
 * The season's specials and two-parters for the roadmap (seasonSlotService
 * roadmapOf). slots are the roadmap's own slot views. twoPartBySlot: slot id
 * → { id, part, of, other_slot_number, label }.
 */
async function roadmapSpecials(sequelize, arc, slots = []) {
  const empty = { ready: false, specials: [], two_parters: [], twoPartBySlot: new Map() };
  if (!(await specialsReady(sequelize))) return empty;
  let rows;
  try {
    rows = await specialRows(sequelize, { arcId: arc.id });
  } catch (err) {
    console.error('[seasonSpecials] the specials could not be read; the roadmap goes without them:', err.message);
    return { ...empty, ready: true };
  }
  const byId = new Map(slots.map((s) => [String(s.id), s]));
  const specials = rows.filter((r) => KINDS.includes(r.kind)).map((r) => specialView(r, slots));
  const twoPartBySlot = new Map();
  const twoParters = [];
  for (const r of rows.filter((x) => x.kind === 'two_part')) {
    const one = byId.get(String(r.part_one_slot_id));
    const two = byId.get(String(r.part_two_slot_id));
    if (!one || !two) continue;
    twoPartBySlot.set(String(one.id), { id: r.id, part: 1, of: 2, other_slot_number: two.slot_number, label: partLabel(one.slot_number, 1) });
    twoPartBySlot.set(String(two.id), { id: r.id, part: 2, of: 2, other_slot_number: one.slot_number, label: partLabel(two.slot_number, 2) });
    twoParters.push({
      id: r.id,
      event: one.event || two.event || null,
      part_one: { slot_id: one.id, slot_number: one.slot_number, label: partLabel(one.slot_number, 1), episode: one.episode, state: one.state },
      part_two: { slot_id: two.id, slot_number: two.slot_number, label: partLabel(two.slot_number, 2), episode: two.episode, state: two.state },
      // Part 2 is made from Part 1 once Part 1 has started.
      can_start_part_two: Boolean(one.episode) && !two.episode,
      // Undone while Part 2 has no episode.
      can_undo: !two.episode,
    });
  }
  return { ready: true, specials, two_parters: twoParters, twoPartBySlot };
}

/** Event ids held by the season's bonus and stand-alone specials (the weekly pencil leaves them out). */
async function eventsInSpecials(sequelize, arcId, { transaction } = {}) {
  if (!(await specialsReady(sequelize, { transaction }))) return new Set();
  const [rows] = await sequelize.query(
    `SELECT event_id FROM ${TABLE} WHERE arc_id = :arcId AND deleted_at IS NULL AND event_id IS NOT NULL AND kind IN ('bonus', 'special')`,
    { replacements: { arcId }, transaction });
  return new Set(rows.map((r) => String(r.event_id)));
}

/** The show's episodes that are a bonus's or special's (in no weekly slot, yet placed). */
async function specialEpisodeIds(sequelize, showId, { transaction } = {}) {
  if (!(await specialsReady(sequelize, { transaction }))) return new Set();
  const [rows] = await sequelize.query(
    `SELECT episode_id FROM ${TABLE} WHERE show_id = :showId AND deleted_at IS NULL AND episode_id IS NOT NULL AND kind IN ('bonus', 'special')`,
    { replacements: { showId }, transaction });
  return new Set(rows.map((r) => String(r.episode_id)));
}

/**
 * The weekly pencil took an event: it leaves any bonus or special of the
 * season that has not started an episode. Returns the labels it left.
 */
async function clearEventFromSpecials(sequelize, { arcId, eventId, transaction }) {
  if (!eventId || !(await specialsReady(sequelize, { transaction }))) return [];
  const [rows] = await sequelize.query(
    `UPDATE ${TABLE} SET event_id = NULL, updated_at = NOW()
      WHERE arc_id = :arcId AND event_id = :eventId AND episode_id IS NULL AND deleted_at IS NULL AND kind IN ('bonus', 'special')
      RETURNING kind, after_slot_number, special_type`,
    { replacements: { arcId, eventId }, transaction });
  return rows.map(specialLabel);
}

/**
 * The two-parter a weekly slot is part of: { id, part, other_slot_id } or
 * null (also before the migration).
 */
async function twoPartOfSlot(sequelize, slotId, { transaction } = {}) {
  if (!slotId || !(await specialsReady(sequelize, { transaction }))) return null;
  const [[row]] = await sequelize.query(
    `SELECT id, part_one_slot_id, part_two_slot_id FROM ${TABLE}
      WHERE kind = 'two_part' AND deleted_at IS NULL AND (part_one_slot_id = :slotId OR part_two_slot_id = :slotId) LIMIT 1`,
    { replacements: { slotId }, transaction });
  if (!row) return null;
  const part = String(row.part_one_slot_id) === String(slotId) ? 1 : 2;
  return { id: row.id, part, other_slot_id: part === 1 ? row.part_two_slot_id : row.part_one_slot_id };
}

/** A slot's part for its episode's snapshot: { part, of, other_slot_number } or null. */
async function twoPartContext(sequelize, slotId, { transaction } = {}) {
  const tp = await twoPartOfSlot(sequelize, slotId, { transaction });
  if (!tp) return null;
  const [[other]] = await sequelize.query('SELECT slot_number FROM season_slots WHERE id = :id', { replacements: { id: tp.other_slot_id }, transaction });
  return { part: tp.part, of: 2, other_slot_number: other ? Number(other.slot_number) : null };
}

// ── Writes: bonus and stand-alone specials ────────────────────────────────
async function activeSeason(sequelize, showId, transaction) {
  const { loadSeason } = require('./seasonLoader');
  const season = await loadSeason(sequelize, showId, { transaction });
  if (!season) throw new SpecialsError('Set up the season first.', 409, 'SEASON_NOT_FOUND');
  return season;
}

function readAfter(value, slotCount) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > Math.max(slotCount, 1)) {
    throw new SpecialsError(`after_slot_number: the weekly episode it follows, 0 to ${slotCount}.`, 400, 'SEASON_SPECIAL_INVALID');
  }
  return n;
}
function readDate(value) {
  if (value == null || value === '') return null;
  const s = String(value);
  if (!ISO.test(s) || new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s) {
    throw new SpecialsError('release_date: a date as YYYY-MM-DD, or empty.', 400, 'SEASON_SPECIAL_INVALID');
  }
  return s;
}
function readTime(value) {
  if (value == null || value === '') return null;
  if (!HHMM.test(String(value))) throw new SpecialsError('release_time: "HH:MM", 24-hour, or empty.', 400, 'SEASON_SPECIAL_INVALID');
  return String(value);
}
function readTitle(value) {
  if (value == null) return null;
  const s = String(value).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, 200) : null;
}

/**
 * The event a special is made from: this show's, live, and not started. A
 * weekly slot that has it pencilled (and has not started) lets it go, as the
 * weekly pencil moves an event; a slot that is part of a two-parter keeps it.
 * Returns { event, moved_from } with moved_from the slot number it left, or null.
 */
async function takeEvent(sequelize, { showId, arc, slots, eventId, specialId = null, transaction }) {
  if (!UUID_RE.test(String(eventId))) throw new SpecialsError('event_id: an event of this show.', 400, 'SEASON_SPECIAL_INVALID');
  const [[event]] = await sequelize.query(
    `SELECT id, name, status, used_in_episode_id FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL FOR UPDATE`,
    { replacements: { eventId, showId }, transaction });
  if (!event) throw new SpecialsError('Event not found for this show.', 404, 'SEASON_EVENT_NOT_FOUND');
  const { findLiveLinkedEpisode } = require('../utils/eventEpisodeLink');
  if (await findLiveLinkedEpisode(sequelize, eventId, { transaction })) {
    throw new SpecialsError(`"${event.name}" has started an episode already: a special is made from an event that has not.`, 409, 'SEASON_EVENT_NOT_AVAILABLE');
  }
  if (!['draft', 'ready'].includes(event.status || 'draft')) {
    throw new SpecialsError(`"${event.name}" is ${event.status}: only a draft or ready event makes a special.`, 409, 'SEASON_EVENT_NOT_AVAILABLE');
  }
  let movedFrom = null;
  const inSlot = slots.find((s) => String(s.event_id || '') === String(eventId));
  if (inSlot) {
    if (inSlot.episode_id || inSlot.locked_at) {
      throw new SpecialsError(`"${event.name}" is E${inSlot.slot_number}'s, which has started.`, 409, 'SEASON_EVENT_NOT_AVAILABLE');
    }
    if (await twoPartOfSlot(sequelize, inSlot.id, { transaction })) {
      throw new SpecialsError(`"${event.name}" is the two-parter in E${inSlot.slot_number}: undo the two-parter first.`, 409, 'SEASON_EVENT_NOT_AVAILABLE');
    }
    await sequelize.query('UPDATE season_slots SET event_id = NULL, updated_at = NOW() WHERE id = :id', { replacements: { id: inSlot.id }, transaction });
    movedFrom = inSlot.slot_number;
  }
  await sequelize.query(
    `UPDATE ${TABLE} SET event_id = NULL, updated_at = NOW()
      WHERE arc_id = :arcId AND event_id = :eventId AND episode_id IS NULL AND deleted_at IS NULL
        AND kind IN ('bonus', 'special') ${specialId ? 'AND id <> :specialId' : ''}`,
    { replacements: { arcId: arc.id, eventId, specialId }, transaction });
  return { event, moved_from: movedFrom };
}

/**
 * + Add a special: { kind: 'bonus'|'special', after_slot_number, event_id?,
 * title?, special_type?, release_date?, release_time? }. A bonus is made from
 * an event; a stand-alone special needs a type and may have an event.
 */
async function createSpecial(sequelize, showId, body = {}) {
  return sequelize.transaction(async (transaction) => {
    await assertReady(sequelize, transaction);
    const kind = String(body.kind || '');
    if (!KINDS.includes(kind)) throw new SpecialsError('kind: bonus or special (a two-parter is made from a slot\'s event).', 400, 'SEASON_SPECIAL_INVALID');
    const { arc, slots } = await activeSeason(sequelize, showId, transaction);
    const after = readAfter(body.after_slot_number, slots.length);
    const specialType = kind === 'special' ? String(body.special_type || 'holiday') : null;
    if (kind === 'special' && !SPECIAL_TYPES.includes(specialType)) {
      throw new SpecialsError(`special_type: one of ${SPECIAL_TYPES.join(', ')}.`, 400, 'SEASON_SPECIAL_INVALID');
    }
    const eventId = body.event_id || null;
    if (kind === 'bonus' && !eventId) throw new SpecialsError('A bonus episode is made from an event: pick one.', 400, 'SEASON_SPECIAL_INVALID');
    let taken = { event: null, moved_from: null };
    if (eventId) taken = await takeEvent(sequelize, { showId, arc, slots, eventId, transaction });
    const title = readTitle(body.title) || taken.event?.name || (kind === 'special' ? TYPE_LABEL[specialType] : null);
    const id = await insertSpecial(sequelize, {
      showId, arcId: arc.id, kind, after, specialType, title, eventId,
      date: readDate(body.release_date), time: readTime(body.release_time), transaction,
    });
    return { id, label: specialLabel({ kind, after_slot_number: after, special_type: specialType }), moved_from: taken.moved_from };
  });
}

/** One bonus or special row, as given (the callers check the event and the place). Returns its id. */
async function insertSpecial(sequelize, { showId, arcId, kind, after, specialType = null, title = null, eventId = null, date = null, time = null, transaction }) {
  const [[row]] = await sequelize.query(
    `INSERT INTO ${TABLE} (id, show_id, arc_id, kind, after_slot_number, special_type, title, event_id, release_date, release_time, created_at, updated_at)
     VALUES (gen_random_uuid(), :showId, :arcId, :kind, :after, :specialType, :title, :eventId, CAST(:date AS date), :time, NOW(), NOW())
     RETURNING id`,
    { replacements: { showId, arcId, kind, after, specialType, title, eventId, date, time }, transaction });
  return row.id;
}

async function lockSpecial(sequelize, showId, specialId, transaction) {
  if (!UUID_RE.test(String(specialId))) throw new SpecialsError('Special not found.', 404, 'SEASON_SPECIAL_NOT_FOUND');
  const [[row]] = await sequelize.query(
    `SELECT sp.*, a.season_number FROM ${TABLE} sp JOIN show_arcs a ON a.id = sp.arc_id
      WHERE sp.id = :specialId AND sp.show_id = :showId AND sp.deleted_at IS NULL FOR UPDATE OF sp`,
    { replacements: { specialId, showId }, transaction });
  if (!row) throw new SpecialsError('Special not found.', 404, 'SEASON_SPECIAL_NOT_FOUND');
  return row;
}

/**
 * Edit a bonus or special: title, special_type, after_slot_number,
 * release_date, release_time, and its event while it has no episode. A date
 * set on one with an episode is that episode's release date too.
 */
async function updateSpecial(sequelize, showId, specialId, body = {}) {
  return sequelize.transaction(async (transaction) => {
    await assertReady(sequelize, transaction);
    const row = await lockSpecial(sequelize, showId, specialId, transaction);
    if (!KINDS.includes(row.kind)) throw new SpecialsError('A two-parter is changed from its slots.', 400, 'SEASON_SPECIAL_INVALID');
    const set = {};
    if (body.title !== undefined) set.title = readTitle(body.title);
    if (body.special_type !== undefined) {
      if (row.kind !== 'special' || !SPECIAL_TYPES.includes(String(body.special_type))) {
        throw new SpecialsError(`special_type: one of ${SPECIAL_TYPES.join(', ')}, on a stand-alone special.`, 400, 'SEASON_SPECIAL_INVALID');
      }
      set.special_type = String(body.special_type);
    }
    if (body.after_slot_number !== undefined) {
      if (row.accepted_at) throw new SpecialsError('It is done: it stays where it aired.', 409, 'SEASON_SPECIAL_LOCKED');
      const { slots } = await activeSeason(sequelize, showId, transaction);
      set.after_slot_number = readAfter(body.after_slot_number, slots.length);
    }
    if (body.release_date !== undefined) set.release_date = readDate(body.release_date);
    if (body.release_time !== undefined) set.release_time = readTime(body.release_time);
    let movedFrom = null;
    if (body.event_id !== undefined) {
      if (row.episode_id) throw new SpecialsError('It has started its episode: its event stays.', 409, 'SEASON_SPECIAL_LOCKED');
      if (!body.event_id && row.kind === 'bonus') throw new SpecialsError('A bonus episode is made from an event.', 400, 'SEASON_SPECIAL_INVALID');
      if (body.event_id) {
        const { arc, slots } = await activeSeason(sequelize, showId, transaction);
        if (String(arc.id) !== String(row.arc_id)) throw new SpecialsError('A past season\'s special keeps its event.', 409, 'SEASON_SPECIAL_LOCKED');
        movedFrom = (await takeEvent(sequelize, { showId, arc, slots, eventId: body.event_id, specialId, transaction })).moved_from;
      }
      set.event_id = body.event_id || null;
    }
    const keys = Object.keys(set);
    if (!keys.length) throw new SpecialsError('Nothing to change.', 400, 'SEASON_SPECIAL_INVALID');
    const assignments = keys.map((k) => (k === 'release_date' ? `${k} = CAST(:${k} AS date)` : `${k} = :${k}`)).join(', ');
    await sequelize.query(`UPDATE ${TABLE} SET ${assignments}, updated_at = NOW() WHERE id = :specialId`,
      { replacements: { ...set, specialId }, transaction });
    if (row.episode_id && !row.accepted_at) {
      if (set.release_date !== undefined) await mirrorAirDate(sequelize, { showId, episodeId: row.episode_id, day: set.release_date, transaction });
      if (set.after_slot_number !== undefined || set.special_type !== undefined || set.title !== undefined) {
        await snapshotSpecialEpisode(sequelize, { specialId, episodeId: row.episode_id, transaction });
      }
    }
    return { id: specialId, moved_from: movedFrom };
  });
}

/** Remove a bonus or special that has not started its episode; its event goes back to the library. */
async function removeSpecial(sequelize, showId, specialId) {
  return sequelize.transaction(async (transaction) => {
    await assertReady(sequelize, transaction);
    const row = await lockSpecial(sequelize, showId, specialId, transaction);
    if (!KINDS.includes(row.kind)) throw new SpecialsError('A two-parter is undone from its slots.', 400, 'SEASON_SPECIAL_INVALID');
    if (row.episode_id) {
      const [[ep]] = await sequelize.query('SELECT id FROM episodes WHERE id = :id AND deleted_at IS NULL', { replacements: { id: row.episode_id }, transaction });
      if (ep) throw new SpecialsError('It has an episode: open the episode to archive it first.', 409, 'SEASON_SPECIAL_LOCKED');
    }
    await sequelize.query(`UPDATE ${TABLE} SET deleted_at = NOW(), updated_at = NOW() WHERE id = :specialId`, { replacements: { specialId }, transaction });
    return { id: specialId, removed: true };
  });
}

async function mirrorAirDate(sequelize, { showId, episodeId, day, transaction }) {
  await sequelize.query(
    `UPDATE episodes SET air_date = ${day ? "(CAST(:day AS date)::timestamp AT TIME ZONE 'UTC')" : 'NULL'}, updated_at = NOW()
      WHERE id = :episodeId AND show_id = :showId AND deleted_at IS NULL`,
    { replacements: { day, episodeId, showId }, transaction });
}

// ── The season snapshot of a special's episode (as seasonSlotService.snapshotEpisode for a slot) ──
async function snapshotSpecialEpisode(sequelize, { specialId, episodeId, transaction }) {
  const [[sp]] = await sequelize.query(
    `SELECT sp.*, a.id AS arc_id, a.title AS arc_title, a.tagline AS arc_tagline, a.logline AS arc_logline,
            a.description AS arc_description, a.phases, COALESCE(a.season_number, 1) AS season_number
       FROM ${TABLE} sp JOIN show_arcs a ON a.id = sp.arc_id WHERE sp.id = :specialId`,
    { replacements: { specialId }, transaction });
  if (!sp) return null;
  const { arcPhases, phaseFor } = require('./seasonSlotService');
  const { clip } = require('./seasonLine');
  const phases = arcPhases(sp);
  const after = Number(sp.after_slot_number) || 0;
  const phaseNumber = sp.kind === 'bonus' ? phaseFor(Math.max(1, after), phases) : null;
  const phase = phaseNumber ? phases.find((p) => Number(p.phase) === phaseNumber) || {} : null;
  const season = sp.season_number || 1;
  const context = {
    season_number: season,
    label: `S${season} · ${specialLabel(sp)}`,
    slot_number: null,
    arc_id: sp.arc_id,
    arc_title: sp.arc_title,
    arc_tagline: sp.arc_tagline || null,
    arc_logline: sp.arc_logline ? clip(sp.arc_logline) : null,
    arc_description: sp.arc_description ? clip(sp.arc_description) : null,
    phase_count: phases.length,
    phase: phase ? {
      number: phaseNumber, title: phase.title || null, tagline: phase.tagline || null, emotional_arc: phase.emotional_arc || null,
      episode_start: Number(phase.episode_start) || null, episode_end: Number(phase.episode_end) || null,
    } : null,
    position_in_phase: null,
    story_purpose: null,
    story_purposes: [],
    special: {
      id: sp.id, kind: sp.kind, special_type: sp.special_type || null, title: sp.title || null,
      after_slot_number: after, label: specialLabel(sp), counts_toward_parts: sp.kind === 'bonus',
    },
    snapshotted_at: new Date().toISOString(),
  };
  await sequelize.query(
    `UPDATE episodes SET season_context = CAST(:context AS jsonb), season_number = :season, updated_at = NOW() WHERE id = :episodeId`,
    { replacements: { context: JSON.stringify(context), season, episodeId }, transaction });
  return context;
}

/** A two-parter's part on its episode's snapshot: the label and the part, kept with the slot's own context. */
async function stampTwoPart(sequelize, { episodeId, slotNumber, part, otherSlotNumber, transaction }) {
  await sequelize.query(
    `UPDATE episodes
        SET season_context = COALESCE(season_context, '{}'::jsonb)
              || jsonb_build_object('label', CONCAT('S', COALESCE(season_context->>'season_number', '1'), ' · ', CAST(:label AS text)),
                                    'two_part', CAST(:twoPart AS jsonb)),
            updated_at = NOW()
      WHERE id = :episodeId AND deleted_at IS NULL AND evaluation_status IS DISTINCT FROM 'accepted'`,
    { replacements: {
      episodeId, label: partLabel(slotNumber, part),
      twoPart: JSON.stringify({ part, of: 2, other_slot_number: otherSlotNumber }),
    }, transaction });
}

/** A part's episode no longer in a two-parter: its plain slot label back, the part dropped. */
async function unstampTwoPart(sequelize, { episodeId, slotNumber, transaction }) {
  await sequelize.query(
    `UPDATE episodes
        SET season_context = (COALESCE(season_context, '{}'::jsonb) - 'two_part')
              || jsonb_build_object('label', CONCAT('S', COALESCE(season_context->>'season_number', '1'), ' · E', CAST(:n AS text))),
            updated_at = NOW()
      WHERE id = :episodeId AND deleted_at IS NULL AND evaluation_status IS DISTINCT FROM 'accepted'`,
    { replacements: { episodeId, n: String(slotNumber) }, transaction });
}

// ── Two-parters ───────────────────────────────────────────────────────────
/**
 * "Make it a two-parter" on a weekly slot with an event (Part 1). Part 2 is
 * the next weekly slot, which must be open (no episode, nothing else
 * pencilled); it takes the same event. Part 1 may have started.
 */
async function createTwoParter(sequelize, showId, body = {}) {
  return sequelize.transaction(async (transaction) => {
    await assertReady(sequelize, transaction);
    const { slots } = await activeSeason(sequelize, showId, transaction);
    const one = slots.find((s) => String(s.id) === String(body.slot_id || ''));
    if (!one) throw new SpecialsError('That slot is not in the season in progress.', 404, 'SEASON_SLOT_NOT_FOUND');
    const two = slots.find((s) => Number(s.slot_number) === Number(one.slot_number) + 1);
    if (!two) throw new SpecialsError(`E${one.slot_number} is the season's last episode: Part 2 needs the next one.`, 409, 'SEASON_TWO_PART_REFUSED');
    const eventId = one.live_event_id || one.event_id || null;
    if (!eventId) throw new SpecialsError(`E${one.slot_number} has no event: pencil the big event in first.`, 409, 'SEASON_TWO_PART_REFUSED');
    if (one.accepted_at || one.episode_evaluation_status === 'accepted') throw new SpecialsError(`E${one.slot_number} is done: a two-parter is planned before Part 1 is complete.`, 409, 'SEASON_TWO_PART_REFUSED');
    if (two.episode_id || two.locked_at) throw new SpecialsError(`E${two.slot_number} has started its own episode: Part 2 needs an open slot.`, 409, 'SEASON_TWO_PART_REFUSED');
    if (two.event_id && String(two.event_id) !== String(eventId)) {
      throw new SpecialsError(`E${two.slot_number} has "${two.event_name || 'another event'}" pencilled: move it to another slot first, so Part 2 can take the event.`, 409, 'SEASON_TWO_PART_REFUSED');
    }
    for (const s of [one, two]) {
      if (await twoPartOfSlot(sequelize, s.id, { transaction })) throw new SpecialsError(`E${s.slot_number} is already in a two-parter.`, 409, 'SEASON_TWO_PART_REFUSED');
    }
    await sequelize.query('UPDATE season_slots SET event_id = :eventId, updated_at = NOW() WHERE id = :id', { replacements: { eventId, id: two.id }, transaction });
    // The event leaves any bonus or special it was in (it cannot be: the weekly pencil took it out; kept safe).
    await clearEventFromSpecials(sequelize, { arcId: one.arc_id, eventId, transaction });
    const [[row]] = await sequelize.query(
      `INSERT INTO ${TABLE} (id, show_id, arc_id, kind, event_id, part_one_slot_id, part_two_slot_id, created_at, updated_at)
       VALUES (gen_random_uuid(), :showId, :arcId, 'two_part', :eventId, :one, :two, NOW(), NOW()) RETURNING id`,
      { replacements: { showId, arcId: one.arc_id, eventId, one: one.id, two: two.id }, transaction });
    if (one.episode_id) await stampTwoPart(sequelize, { episodeId: one.episode_id, slotNumber: one.slot_number, part: 1, otherSlotNumber: two.slot_number, transaction });
    return { id: row.id, part_one: partLabel(one.slot_number, 1), part_two: partLabel(two.slot_number, 2) };
  });
}

async function lockTwoParter(sequelize, showId, id, transaction) {
  if (!UUID_RE.test(String(id))) throw new SpecialsError('Two-parter not found.', 404, 'SEASON_TWO_PART_NOT_FOUND');
  const [[row]] = await sequelize.query(
    `SELECT tp.id, tp.event_id, tp.part_one_slot_id, tp.part_two_slot_id,
            one.slot_number AS one_number, one.episode_id AS one_episode_id, one.event_id AS one_event_id, one.arc_id,
            two.slot_number AS two_number, two.episode_id AS two_episode_id, two.event_id AS two_event_id, two.locked_at AS two_locked_at,
            COALESCE(a.season_number, 1) AS season_number
       FROM ${TABLE} tp
       JOIN season_slots one ON one.id = tp.part_one_slot_id
       JOIN season_slots two ON two.id = tp.part_two_slot_id
       JOIN show_arcs a ON a.id = tp.arc_id
      WHERE tp.id = :id AND tp.show_id = :showId AND tp.kind = 'two_part' AND tp.deleted_at IS NULL
      FOR UPDATE OF tp`,
    { replacements: { id, showId }, transaction });
  if (!row) throw new SpecialsError('Two-parter not found.', 404, 'SEASON_TWO_PART_NOT_FOUND');
  return row;
}

const liveEpisode = async (sequelize, id, transaction) => {
  if (!id) return null;
  const [[ep]] = await sequelize.query(
    'SELECT id, title, description, show_id, evaluation_status, evaluation_json FROM episodes WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id }, transaction });
  return ep || null;
};

/** Undo a two-parter while Part 2 has no episode: Part 2's slot is open again. */
async function removeTwoParter(sequelize, showId, id) {
  return sequelize.transaction(async (transaction) => {
    await assertReady(sequelize, transaction);
    const row = await lockTwoParter(sequelize, showId, id, transaction);
    if (await liveEpisode(sequelize, row.two_episode_id, transaction)) {
      throw new SpecialsError(`Part 2 (E${row.two_number}) has its episode: the two-parter stays.`, 409, 'SEASON_TWO_PART_LOCKED');
    }
    await sequelize.query(
      `UPDATE season_slots SET event_id = NULL, episode_id = NULL, locked_at = NULL, updated_at = NOW()
        WHERE id = :id AND (event_id = :eventId OR event_id IS NULL)`,
      { replacements: { id: row.part_two_slot_id, eventId: row.one_event_id || row.event_id }, transaction });
    await sequelize.query(`UPDATE ${TABLE} SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id`, { replacements: { id }, transaction });
    if (row.one_episode_id) await unstampTwoPart(sequelize, { episodeId: row.one_episode_id, slotNumber: row.one_number, transaction });
    return { id, removed: true };
  });
}

/** The columns of a brief Part 2 copies from Part 1 (the event's): everything but its own identity and drafts. */
const BRIEF_SKIP = new Set(['id', 'episode_id', 'status', 'created_at', 'updated_at', 'deleted_at', 'ai_generated_at',
  'beat_outline', 'forward_hook', 'narrative_purpose', 'event_metadata', 'lala_state_snapshot', 'arc_number', 'position_in_arc']);

/**
 * Start Part 2: its episode, made from Part 1 once Part 1 has started.
 * The same event is on its brief (the script writer reads it), and none of
 * the event's money, tasks, invitation or deal is made again: Part 1 holds
 * them. Part 2's slot locks to it and its snapshot says "Part 2/2".
 */
async function startPartTwo(sequelize, showId, id) {
  return sequelize.transaction(async (transaction) => {
    await assertReady(sequelize, transaction);
    const row = await lockTwoParter(sequelize, showId, id, transaction);
    const one = await liveEpisode(sequelize, row.one_episode_id, transaction);
    if (!one) throw new SpecialsError(`Start Part 1 (E${row.one_number}) from its event first: Part 2 is made from it.`, 409, 'SEASON_TWO_PART_REFUSED');
    if (await liveEpisode(sequelize, row.two_episode_id, transaction)) {
      throw new SpecialsError(`Part 2 (E${row.two_number}) has its episode already.`, 409, 'SEASON_TWO_PART_REFUSED');
    }
    const [[{ n }]] = await sequelize.query(
      'SELECT COALESCE(MAX(episode_number), 0) + 1 AS n FROM episodes WHERE show_id = :showId AND deleted_at IS NULL',
      { replacements: { showId }, transaction });
    const title = `${String(one.title || 'Episode').replace(/\s*\(Part 1\)\s*$/i, '')} (Part 2)`.slice(0, 250);
    const [[ep]] = await sequelize.query(
      `INSERT INTO episodes (id, show_id, title, description, episode_number, status, total_income, total_expenses, created_at, updated_at)
       VALUES (gen_random_uuid(), :showId, :title, :description, :n, 'draft', 0, 0, NOW(), NOW()) RETURNING id, title, episode_number`,
      { replacements: { showId, title, description: one.description || null, n }, transaction });

    const [cols] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'episode_briefs'`,
      { transaction });
    const copy = cols.map((c) => c.column_name).filter((c) => !BRIEF_SKIP.has(c));
    const list = copy.map((c) => `"${c}"`).join(', ');
    const [copied] = await sequelize.query(
      `INSERT INTO episode_briefs (id, episode_id, status, created_at, updated_at${list ? `, ${list}` : ''})
       SELECT gen_random_uuid(), :episodeId, 'draft', NOW(), NOW()${list ? `, ${list}` : ''}
         FROM episode_briefs WHERE episode_id = :partOne AND deleted_at IS NULL
        ORDER BY created_at DESC LIMIT 1
       RETURNING id`,
      { replacements: { episodeId: ep.id, partOne: one.id }, transaction });
    if (!copied.length) {
      await sequelize.query(
        `INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
         VALUES (gen_random_uuid(), :episodeId, :showId, :eventId, 'draft', NOW(), NOW())`,
        { replacements: { episodeId: ep.id, showId, eventId: row.one_event_id || row.event_id }, transaction });
    }
    await sequelize.query(
      `UPDATE season_slots SET episode_id = :episodeId, event_id = COALESCE(event_id, :eventId), locked_at = NOW(), updated_at = NOW() WHERE id = :slotId`,
      { replacements: { episodeId: ep.id, eventId: row.one_event_id || row.event_id, slotId: row.part_two_slot_id }, transaction });
    const { snapshotEpisode } = require('./seasonSlotService');
    await snapshotEpisode(sequelize, { slotId: row.part_two_slot_id, episodeId: ep.id, transaction });
    await stampTwoPart(sequelize, { episodeId: ep.id, slotNumber: row.two_number, part: 2, otherSlotNumber: row.one_number, transaction });
    await stampTwoPart(sequelize, { episodeId: one.id, slotNumber: row.one_number, part: 1, otherSlotNumber: row.two_number, transaction });
    return { episode: { id: ep.id, title: ep.title, episode_number: ep.episode_number }, label: partLabel(row.two_number, 2) };
  });
}

// ── Start Episode and completion ──────────────────────────────────────────
/**
 * Start Episode for an event in a bonus or special (seasonSlotService
 * assignOnStart asks this first, so a special's event never takes the next
 * weekly slot). A regenerate moves the replaced episode's special to the new
 * one. Its hand-set date becomes the episode's release date. Returns the
 * special's label, or null when the event is in none.
 */
async function assignSpecialOnStart(sequelize, { showId, eventId, episodeId, replacingEpisodeId = null, transaction }) {
  if (!(await specialsReady(sequelize, { transaction }))) return null;
  let rows = [];
  if (replacingEpisodeId) {
    [rows] = await sequelize.query(
      `UPDATE ${TABLE} SET episode_id = :episodeId, updated_at = NOW()
        WHERE episode_id = :replacingEpisodeId AND deleted_at IS NULL RETURNING id, kind, after_slot_number, special_type, release_date`,
      { replacements: { episodeId, replacingEpisodeId }, transaction });
  }
  if (!rows.length) {
    [rows] = await sequelize.query(
      `UPDATE ${TABLE} sp SET episode_id = :episodeId, locked_at = NOW(), updated_at = NOW()
        FROM show_arcs a
       WHERE a.id = sp.arc_id AND a.deleted_at IS NULL AND sp.show_id = :showId AND sp.event_id = :eventId
         AND sp.episode_id IS NULL AND sp.deleted_at IS NULL AND sp.kind IN ('bonus', 'special')
         AND sp.id = (SELECT x.id FROM ${TABLE} x WHERE x.show_id = :showId AND x.event_id = :eventId AND x.episode_id IS NULL
                        AND x.deleted_at IS NULL AND x.kind IN ('bonus', 'special') ORDER BY x.created_at DESC LIMIT 1)
       RETURNING sp.id, sp.kind, sp.after_slot_number, sp.special_type, sp.release_date`,
      { replacements: { showId, eventId, episodeId }, transaction });
  }
  if (!rows.length) return null;
  const sp = rows[0];
  await snapshotSpecialEpisode(sequelize, { specialId: sp.id, episodeId, transaction });
  const day = dayText(sp.release_date);
  if (day) await mirrorAirDate(sequelize, { showId, episodeId, day, transaction });
  return specialLabel(sp);
}

/** Accepting a special's episode records its result on the special (no phase boundary: it is in no part). */
async function recordSpecialOutcome(sequelize, { showId, episodeId, tier, pressure }) {
  if (!(await specialsReady(sequelize))) return null;
  const [rows] = await sequelize.query(
    `UPDATE ${TABLE} SET actual_outcome = :tier, actual_pressure = :pressure, accepted_at = NOW(), updated_at = NOW()
      WHERE episode_id = :episodeId AND show_id = :showId AND deleted_at IS NULL RETURNING kind, after_slot_number, special_type`,
    { replacements: { tier, pressure, episodeId, showId } });
  return rows.length ? specialLabel(rows[0]) : null;
}

/**
 * The episode's place in a two-parter: { role: 'part_one'|'part_two', row }
 * or null (also before the migration). row has both slots and episodes.
 */
async function twoPartRole(sequelize, { episodeId }) {
  if (!(await specialsReady(sequelize))) return null;
  const [[row]] = await sequelize.query(
    `SELECT tp.id, tp.show_id, one.slot_number AS one_number, one.episode_id AS one_episode_id,
            two.slot_number AS two_number, two.episode_id AS two_episode_id, two.id AS two_slot_id
       FROM ${TABLE} tp
       JOIN season_slots one ON one.id = tp.part_one_slot_id AND one.deleted_at IS NULL
       JOIN season_slots two ON two.id = tp.part_two_slot_id AND two.deleted_at IS NULL
      WHERE tp.kind = 'two_part' AND tp.deleted_at IS NULL AND (one.episode_id = :episodeId OR two.episode_id = :episodeId)
      LIMIT 1`,
    { replacements: { episodeId } });
  if (!row) return null;
  return { role: String(row.one_episode_id) === String(episodeId) ? 'part_one' : 'part_two', row };
}

/**
 * Completing a part of a two-parter (episodeCompletionService completeEpisode
 * asks first). Part 1 alone: refused, "to be continued". Part 2: the one
 * completion of the event runs on Part 1 (completeEpisode with partOne),
 * then Part 2 is accepted with the same result, its slot records it, and the
 * season checks for a phase boundary at Part 2.
 */
async function completeTwoPart(found, { completeEpisode, episodeId, showId, sequelize, options = {} }) {
  const { row } = found;
  if (found.role === 'part_one') {
    throw new SpecialsError(
      `E${row.one_number} is Part 1 of a two-parter: to be continued. The event completes with Part 2 (E${row.two_number}): `
      + `${row.two_episode_id ? 'complete Part 2' : 'start Part 2 from the Roadmap, then complete it'}, and Part 1 is completed with it. `
      + 'To complete Part 1 on its own, undo the two-parter first.',
      409, 'TWO_PART_TO_BE_CONTINUED');
  }
  const one = await liveEpisode(sequelize, row.one_episode_id);
  if (!one) throw new SpecialsError(`Part 1 (E${row.one_number}) has no live episode, so the event cannot complete.`, 409, 'TWO_PART_REFUSED');
  const result = await completeEpisode(one.id, showId, sequelize, { ...options, twoPartOne: true });
  const evaluation = result?.evaluation || (await liveEpisode(sequelize, one.id))?.evaluation_json || null;
  const parsed = typeof evaluation === 'string' ? JSON.parse(evaluation) : evaluation;
  const tier = parsed?.tier_final || parsed?.tier || null;
  const partTwoEval = { ...(parsed || {}), two_part: { part: 2, of: 2, completed_with_episode_id: one.id, part_one_slot_number: row.one_number } };
  await sequelize.query(
    `UPDATE episodes SET evaluation_status = 'accepted', evaluation_json = CAST(:evaluation AS jsonb), updated_at = NOW()
      WHERE id = :episodeId AND deleted_at IS NULL AND evaluation_status IS DISTINCT FROM 'accepted'`,
    { replacements: { episodeId, evaluation: JSON.stringify(partTwoEval) } });
  const [[oneSlot]] = await sequelize.query(
    'SELECT actual_outcome, actual_pressure FROM season_slots WHERE episode_id = :id AND deleted_at IS NULL LIMIT 1', { replacements: { id: one.id } });
  await sequelize.query(
    `UPDATE season_slots SET actual_outcome = :tier, actual_pressure = :pressure, accepted_at = COALESCE(accepted_at, NOW()), updated_at = NOW()
      WHERE id = :slotId`,
    { replacements: { tier: oneSlot?.actual_outcome || tier, pressure: oneSlot?.actual_pressure || null, slotId: row.two_slot_id } });
  let phaseBoundary = null;
  try {
    const { checkPhaseTransition } = require('./arcProgressionService');
    const transition = await checkPhaseTransition(showId, row.two_number, { sequelize });
    phaseBoundary = transition
      ? { phase: transition.current_phase?.phase, title: transition.current_phase?.title, next_phase: transition.next_phase?.title || null }
      : null;
  } catch (err) {
    console.error('[seasonSpecials] the phase check after Part 2 failed (the parts are done):', err.message);
  }
  return {
    ...result,
    already_completed: Boolean(result?.already_completed),
    two_part: { completed: true, part_one_episode_id: one.id, part_two_episode_id: episodeId, part_one: partLabel(row.one_number, 1), part_two: partLabel(row.two_number, 2) },
    season: result?.season ? { ...result.season, slot_number: row.two_number, phase_boundary: phaseBoundary ?? result.season.phase_boundary } : result?.season,
  };
}

// ── The release schedule ──────────────────────────────────────────────────
/**
 * Every bonus and special of the show with its hand-set date, for the
 * release schedule; and the two-parters' slots. [] each before the migration.
 */
async function releaseSpecials(sequelize, showId) {
  if (!(await specialsReady(sequelize))) return { specials: [], two_parts: [] };
  try {
    const rows = await specialRows(sequelize, { showId });
    const specials = rows.filter((r) => KINDS.includes(r.kind)).map((r) => ({
      id: r.id,
      kind: r.kind,
      special_type: r.special_type || null,
      arc_id: r.arc_id,
      season_number: Number(r.season_number) || 1,
      after_slot_number: Number(r.after_slot_number) || 0,
      title: r.title || r.event_name || r.episode_title || null,
      label: specialLabel(r),
      episode_id: r.live_episode_id || null,
      episode_status: r.episode_status || null,
      event_id: r.live_event_id || null,
      event_date: r.event_date || null,
      release_date: r.release_day || dayText(r.release_date),
      release_time: r.release_time || null,
    }));
    const [parts] = await sequelize.query(
      `SELECT tp.id, COALESCE(a.season_number, 1) AS season_number, one.slot_number AS one_number, two.slot_number AS two_number
         FROM ${TABLE} tp JOIN show_arcs a ON a.id = tp.arc_id AND a.deleted_at IS NULL
         JOIN season_slots one ON one.id = tp.part_one_slot_id
         JOIN season_slots two ON two.id = tp.part_two_slot_id
        WHERE tp.show_id = :showId AND tp.kind = 'two_part' AND tp.deleted_at IS NULL`,
      { replacements: { showId } });
    return { specials, two_parts: parts };
  } catch (err) {
    console.error('[seasonSpecials] the specials could not be read; the release schedule goes without them:', err.message);
    return { specials: [], two_parts: [] };
  }
}

module.exports = {
  TABLE,
  KINDS,
  SPECIAL_TYPES,
  TYPE_LABEL,
  MIGRATION_PENDING,
  SpecialsError,
  specialsReady,
  specialLabel,
  partLabel,
  roadmapSpecials,
  eventsInSpecials,
  specialEpisodeIds,
  clearEventFromSpecials,
  twoPartOfSlot,
  twoPartContext,
  createSpecial,
  insertSpecial,
  takeEvent,
  specialRows,
  dayText,
  mirrorAirDate,
  assertReady,
  updateSpecial,
  removeSpecial,
  createTwoParter,
  removeTwoParter,
  startPartTwo,
  snapshotSpecialEpisode,
  assignSpecialOnStart,
  recordSpecialOutcome,
  twoPartRole,
  completeTwoPart,
  releaseSpecials,
};
