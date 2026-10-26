'use strict';

/**
 * Automatic specials when the season is full (Evoni, 2026-10-26: "So I want
 * to be sure that if I start creating any events that is over the 24
 * episodes, they will be known as the special episodes automatically?" …
 * "Yes placed events should be seen as full, they should have both options,
 * no limit" — "Yes to both, build it and show me first").
 *
 * Full: every one of the season's weekly slots has an event pencilled or an
 * episode started. A slot with no event is open, even when it has a purpose.
 * A two-parter's event is in both of its slots, so it fills both.
 *
 * When the season is full and an event is in none of its slots, it "will be
 * a special", and Evoni always has both options, with no limit on specials:
 *
 *   Make it a special   a bonus special (services/seasonSpecials) in story
 *                       order: after the weekly episode whose event's
 *                       in-world date is the latest on or before this
 *                       event's ("Special · after E4"), released midweek
 *                       between that Sunday and the next (releaseSchedule
 *                       suggestSpecialDate, the specials' own suggestion).
 *                       When the later Sunday of that gap is already out,
 *                       it takes the first gap after it whose Sunday is not.
 *                       An event with no in-world date goes after the last
 *                       episode of the part in progress ("No date yet: place
 *                       it when you know"); once it has a date, the event
 *                       page offers to move it to its story position.
 *   Swap it into E_n    the event takes weekly slot n (not started, not in a
 *                       two-parter), and the event it replaces becomes a
 *                       special at its own story position (the same rule).
 *                       The suggested slot is the one whose event's date is
 *                       nearest.
 *
 * Start Episode on a full season with an event in no slot (seasonSlotService
 * assignOnStart) makes it the special at its suggested position, so no
 * episode is left outside the season. Every change has a way back: Move it
 * (any place, or its story position), Swap (back), Move to the next season
 * where one exists, or Remove the special (the event is unplaced again).
 * Nothing is deleted: a special left without its event is soft-deleted, as
 * seasonSpecials' own Remove does.
 *
 * Before the specials' migration (specialsReady false) nothing here writes:
 * the choice says plainly that specials need their migration, and Start
 * Episode keeps today's behaviour (an episode with no open slot stays in no
 * slot, listed on the roadmap to place).
 *
 *   seasonFull(slots)                    pure: every slot has an event or an episode
 *   storyPosition({ dated, eventDate, released, slotCount, partEnd })   pure
 *   fullChoice(sequelize, showId, eventId)          the Event page's choice
 *   makeSpecial / swapIntoSlot / moveToStory / moveToNextSeason
 *   specialOnFullStart(sequelize, { showId, eventId, episodeId, transaction })
 * No AI call. No migration: it writes season_specials and season_slots only.
 */

const specials = require('./seasonSpecials');

const { SpecialsError, specialLabel } = specials;
const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An in-world date as 'YYYY-MM-DD' when it starts with one (event_date is free text), else null. */
function isoDay(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const m = ISO.exec(String(v).trim());
  if (!m) return null;
  const s = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

/** A slot (a loadSeason row or a roadmap view) holds an event or an episode. */
const slotFilled = (s) => Boolean(s && (s.live_event_id || s.live_episode_id || s.event?.id || s.episode?.id));

/** Full: the season has slots and every one has an event pencilled or an episode started. */
function seasonFull(slots) {
  return Array.isArray(slots) && slots.length > 0 && slots.every(slotFilled);
}

/**
 * Where a special goes in story order. dated: [{ slot_number, date }] (the
 * weekly slots' events with an in-world date). With a date: after the slot
 * whose date is the latest on or before it (a tie: the later slot); before
 * them all: 0 ("before E1"). With none: after partEnd, the last episode of
 * the part in progress. Then past every gap whose later Sunday is released.
 * Returns { after, by: 'date' | 'no_date', skipped } (skipped: the gaps passed).
 */
function storyPosition({ dated = [], eventDate = null, released = new Set(), slotCount = 24, partEnd = 8 } = {}) {
  const date = isoDay(eventDate);
  let after;
  if (date) {
    const before = dated.filter((d) => d.date && d.date <= date)
      .sort((a, b) => (a.date === b.date ? a.slot_number - b.slot_number : a.date.localeCompare(b.date)));
    after = before.length ? Number(before[before.length - 1].slot_number) : 0;
  } else {
    after = Math.min(Math.max(Number(partEnd) || 0, 0), slotCount);
  }
  let skipped = 0;
  while (after < slotCount && released.has(after + 1)) { after += 1; skipped += 1; }
  return { after, by: date ? 'date' : 'no_date', skipped };
}

/** The swap slot to suggest: among those that can swap, the one whose event's date is nearest; with no date, none. */
function nearestSwap(options, eventDate) {
  const date = isoDay(eventDate);
  const open = options.filter((o) => o.can_swap);
  if (!date) return null;
  const ms = (d) => Date.parse(`${d}T00:00:00Z`);
  const scored = open.filter((o) => o.event?.date).map((o) => ({ o, gap: Math.abs(ms(o.event.date) - ms(date)) }));
  if (!scored.length) return null;
  scored.sort((a, b) => a.gap - b.gap || a.o.slot_number - b.o.slot_number);
  return scored[0].o;
}

// ── What the season looks like now ───────────────────────────────────────
/**
 * The season, its events' dates, which slots are released, the release
 * dates by slot, the two-parters' slots and the part in progress. null
 * when the show has no active season.
 */
async function loadPicture(sequelize, showId, { transaction, now = new Date() } = {}) {
  const { loadSeason } = require('./seasonLoader');
  const season = await loadSeason(sequelize, showId, { transaction });
  if (!season) return null;
  const { arc, slots } = season;
  const ready = await specials.specialsReady(sequelize, { transaction });
  const ids = slots.map((s) => s.live_event_id).filter(Boolean);
  const dateOf = new Map();
  if (ids.length) {
    const [evs] = await sequelize.query('SELECT id, event_date FROM world_events WHERE id IN (:ids)', { replacements: { ids }, transaction });
    for (const ev of evs) dateOf.set(String(ev.id), isoDay(ev.event_date));
  }
  const twoPart = new Map();
  if (ready) {
    const [parts] = await sequelize.query(
      `SELECT part_one_slot_id, part_two_slot_id FROM ${specials.TABLE} WHERE arc_id = :arcId AND kind = 'two_part' AND deleted_at IS NULL`,
      { replacements: { arcId: arc.id }, transaction });
    for (const p of parts) {
      twoPart.set(String(p.part_one_slot_id), 1);
      twoPart.set(String(p.part_two_slot_id), 2);
    }
  }
  // The release dates (the weekly schedule) and which Sundays are out.
  let numbers = {};
  let schedule = null;
  const released = new Set();
  try {
    const rs = require('./releaseSchedule');
    const view = await rs.viewFor(sequelize, showId, { now });
    schedule = view?.schedule || null;
    const mine = (view?.seasons || []).find((x) => Number(x.season_number) === Number(arc.season_number || 1));
    numbers = mine?.slots || view?.slots || {};
    const active = (mine?.state || view?.state) === 'active';
    for (const s of slots) {
      const entry = numbers[s.slot_number];
      const out = s.episode_status === 'published'
        || (active && entry?.date && rs.zonedInstant(entry.date, entry.time || schedule?.time, schedule).getTime() <= new Date(now).getTime());
      if (out) released.add(Number(s.slot_number));
    }
  } catch (err) {
    console.error('[seasonFullSpecials] the release schedule could not be read; specials are placed without it:', err.message);
  }
  const { arcPhases } = require('./seasonSlotService');
  const phases = arcPhases(arc);
  const current = phases.find((p) => Number(p.phase) === Number(arc.current_phase)) || phases[0] || null;
  return {
    arc,
    slots,
    ready,
    full: seasonFull(slots),
    dateOf,
    twoPart,
    released,
    numbers,
    schedule,
    part: current ? { number: Number(current.phase), title: current.title || null, episode_end: Number(current.episode_end) || 8 } : { number: 1, title: null, episode_end: 8 },
  };
}

/** The weekly slots' dated events, with one slot's event replaced (a swap) or left out. */
function datedSlots(pic, { slotId = null, eventDate = null } = {}) {
  return pic.slots.map((s) => ({
    slot_number: Number(s.slot_number),
    date: slotId && String(s.id) === String(slotId) ? isoDay(eventDate) : (s.live_event_id ? pic.dateOf.get(String(s.live_event_id)) || null : null),
  })).filter((d) => d.date);
}

/** A special's place and its suggested release: { after, label, by, skipped, release }. */
function placeFor(pic, eventDate, swap = {}) {
  const pos = storyPosition({
    dated: datedSlots(pic, swap), eventDate, released: pic.released, slotCount: pic.slots.length, partEnd: pic.part.episode_end,
  });
  const { suggestSpecialDate } = require('./releaseSchedule');
  const release = suggestSpecialDate({ kind: 'bonus', after_slot_number: pos.after, event_date: isoDay(eventDate) }, pic.numbers, pic.schedule);
  return { ...pos, label: specialLabel({ kind: 'bonus', after_slot_number: pos.after }), release };
}

/** Why a weekly slot cannot take a swap, or null. */
function swapRefusal(pic, slot, eventId) {
  const n = slot.slot_number;
  if (String(slot.live_event_id || '') === String(eventId)) return `It is E${n}'s event already.`;
  if (slot.live_episode_id || slot.locked_at) return `E${n} has started: it is locked to its episode.`;
  const part = pic.twoPart.get(String(slot.id));
  if (part) return `E${n} is Part ${part} of a two-parter: a swap would split it. Undo the two-parter on the Roadmap first, or pick another episode.`;
  return null;
}

async function eventRow(sequelize, showId, eventId, { transaction, lock = false } = {}) {
  if (!UUID_RE.test(String(eventId))) throw new SpecialsError('Event not found for this show.', 404, 'SEASON_EVENT_NOT_FOUND');
  const [[ev]] = await sequelize.query(
    `SELECT id, name, status, event_date, used_in_episode_id FROM world_events
      WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
    { replacements: { eventId, showId }, transaction });
  if (!ev) throw new SpecialsError('Event not found for this show.', 404, 'SEASON_EVENT_NOT_FOUND');
  return ev;
}

/** The event's bonus or special in this season (its event, or the episode it started), or null. */
async function specialOfEvent(sequelize, arcId, ev, { transaction, lock = false } = {}) {
  const [[row]] = await sequelize.query(
    `SELECT sp.*, to_char(sp.release_date, 'YYYY-MM-DD') AS release_day FROM ${specials.TABLE} sp
      WHERE sp.arc_id = :arcId AND sp.deleted_at IS NULL AND sp.kind IN ('bonus', 'special')
        AND (sp.event_id = :eventId OR (CAST(:episodeId AS uuid) IS NOT NULL AND sp.episode_id = CAST(:episodeId AS uuid)))
      ORDER BY sp.created_at DESC LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    { replacements: { arcId, eventId: ev.id, episodeId: ev.used_in_episode_id || null }, transaction });
  return row || null;
}

/** The next season of the show (season number above this one's) and its first open slot, or null. */
async function nextSeason(sequelize, arc, { transaction } = {}) {
  const [[next]] = await sequelize.query(
    `SELECT id, title, COALESCE(season_number, 1) AS season_number FROM show_arcs
      WHERE show_id = :showId AND deleted_at IS NULL AND id <> :arcId AND COALESCE(season_number, 1) > :season
      ORDER BY season_number ASC, created_at ASC LIMIT 1`,
    { replacements: { showId: arc.show_id, arcId: arc.id, season: Number(arc.season_number || 1) }, transaction });
  if (!next) return null;
  const [[open]] = await sequelize.query(
    `SELECT id, slot_number FROM season_slots
      WHERE arc_id = :arcId AND deleted_at IS NULL AND episode_id IS NULL AND locked_at IS NULL AND event_id IS NULL
      ORDER BY slot_number ASC LIMIT 1`,
    { replacements: { arcId: next.id }, transaction });
  return {
    arc_id: next.id, season_number: Number(next.season_number), title: next.title || null,
    open_slot_id: open?.id || null, open_slot_number: open ? Number(open.slot_number) : null,
  };
}

const whenText = (release) => (release?.date ? release.date : null);

/**
 * The Event page's choice for one event. Always { ready, full, ... }; null
 * with no active season. `where` is 'slot' | 'special' | 'none'.
 */
async function fullChoice(sequelize, showId, eventId, { now = new Date() } = {}) {
  const ev = await eventRow(sequelize, showId, eventId);
  const pic = await loadPicture(sequelize, showId, { now });
  if (!pic) return null;
  const eventDate = isoDay(ev.event_date);
  const inSlot = pic.slots.find((s) => String(s.live_event_id || '') === String(ev.id)
    || (ev.used_in_episode_id && String(s.live_episode_id || '') === String(ev.used_in_episode_id)));
  const base = {
    ready: pic.ready,
    full: pic.full,
    slot_count: pic.slots.length,
    open_slots: pic.slots.filter((s) => !slotFilled(s)).length,
    season_number: Number(pic.arc.season_number || 1),
    part: pic.part,
    event: { id: ev.id, name: ev.name, event_date: eventDate, has_date: Boolean(eventDate), started: Boolean(ev.used_in_episode_id) },
  };
  if (inSlot) return { ...base, where: 'slot', slot_number: Number(inSlot.slot_number) };
  if (!pic.ready) {
    return {
      ...base,
      where: 'none',
      needs_migration: true,
      message: 'Special episodes need their migration first (20261026150000-create-season-specials). Until it has run, an event over the season\'s weekly episodes stays unplaced, and Start Episode leaves its episode in no slot.',
    };
  }
  const sp = await specialOfEvent(sequelize, pic.arc.id, ev);
  const place = placeFor(pic, eventDate);
  const options = pic.slots.map((s) => {
    const reason = swapRefusal(pic, s, ev.id);
    const replaced = s.live_event_id ? { id: s.live_event_id, name: s.event_name, date: pic.dateOf.get(String(s.live_event_id)) || null } : null;
    const becomes = !reason && replaced ? placeFor(pic, replaced.date, { slotId: s.id, eventDate }) : null;
    return {
      slot_id: s.id,
      slot_number: Number(s.slot_number),
      event: replaced,
      can_swap: !reason,
      reason,
      becomes: becomes ? { after: becomes.after, label: becomes.label, by: becomes.by, release: becomes.release } : null,
    };
  });
  const suggested = nearestSwap(options, eventDate) || options.find((o) => o.can_swap) || null;
  const next = await nextSeason(sequelize, pic.arc);
  const special = sp ? {
    id: sp.id,
    kind: sp.kind,
    label: specialLabel(sp),
    after_slot_number: Number(sp.after_slot_number) || 0,
    started: Boolean(sp.episode_id),
    episode_id: sp.episode_id || null,
    done: Boolean(sp.accepted_at),
    release: { date: sp.release_day || null, time: sp.release_time || null },
  } : null;
  return {
    ...base,
    where: special ? 'special' : 'none',
    special,
    // Where it goes in story order (an existing special: where it would move to).
    special_place: { after: place.after, label: place.label, by: place.by, skipped_released: place.skipped, release: place.release, when: whenText(place.release) },
    at_story_position: special ? special.after_slot_number === place.after : null,
    swap: { suggested_slot_id: suggested?.slot_id || null, options },
    next_season: next,
    // What Start Episode does with it now (assignOnStart).
    start_note: !special && pic.full
      ? `The season is full: Start Episode makes it ${place.label}${place.by === 'no_date' ? ' (no date yet)' : ''}, unless you choose here first.`
      : null,
  };
}

// ── Actions ───────────────────────────────────────────────────────────────
async function activePicture(sequelize, showId, transaction) {
  await specials.assertReady(sequelize, transaction);
  const pic = await loadPicture(sequelize, showId, { transaction });
  if (!pic) throw new SpecialsError('Set up the season first.', 409, 'SEASON_NOT_FOUND');
  return pic;
}

/** A special's release when it moves: the suggestion, else what it had (the date is still Evoni's to change). */
const releaseFields = (place) => (place.release?.date ? { date: place.release.date, time: place.release.time || null } : { date: null, time: null });

/** Make it a special: a bonus at its story position, dated midweek. */
async function makeSpecial(sequelize, showId, eventId) {
  return sequelize.transaction(async (transaction) => {
    const pic = await activePicture(sequelize, showId, transaction);
    const ev = await eventRow(sequelize, showId, eventId, { transaction, lock: true });
    const existing = await specialOfEvent(sequelize, pic.arc.id, ev, { transaction });
    if (existing) throw new SpecialsError(`"${ev.name}" is ${specialLabel(existing)} already: use Move it to change its place.`, 409, 'SEASON_SPECIAL_EXISTS');
    const place = placeFor(pic, ev.event_date);
    // The specials' own checks: not started, draft or ready; a pencilled, unstarted slot lets it go.
    const taken = await specials.takeEvent(sequelize, { showId, arc: pic.arc, slots: pic.slots, eventId: ev.id, transaction });
    const rel = releaseFields(place);
    const id = await specials.insertSpecial(sequelize, {
      showId, arcId: pic.arc.id, kind: 'bonus', after: place.after, title: ev.name, eventId: ev.id, date: rel.date, time: rel.time, transaction,
    });
    return { id, label: place.label, after_slot_number: place.after, by: place.by, release: place.release, moved_from: taken.moved_from };
  });
}

/** Clear an episode's air_date when it is the special's own date (mirrored), so the weekly schedule dates it again. */
async function unmirror(sequelize, { episodeId, day, transaction }) {
  if (!episodeId || !day) return;
  await sequelize.query(
    `UPDATE episodes SET air_date = NULL, updated_at = NOW()
      WHERE id = :episodeId AND to_char(air_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') = :day`,
    { replacements: { episodeId, day }, transaction });
}

/**
 * Swap it into E_n: the event takes weekly slot slotId, and the event that
 * was there becomes a special at its own story position. An event already
 * a special (also one whose episode started on a full season) hands that
 * special to the replaced event; its episode, if any, moves into the slot.
 */
async function swapIntoSlot(sequelize, showId, eventId, slotId) {
  return sequelize.transaction(async (transaction) => {
    const pic = await activePicture(sequelize, showId, transaction);
    const ev = await eventRow(sequelize, showId, eventId, { transaction, lock: true });
    const slot = pic.slots.find((s) => String(s.id) === String(slotId || ''));
    if (!slot) throw new SpecialsError('That episode is not in the season in progress.', 404, 'SEASON_SLOT_NOT_FOUND');
    const refusal = swapRefusal(pic, slot, ev.id);
    if (refusal) throw new SpecialsError(refusal, 409, 'SEASON_SWAP_REFUSED');
    const elsewhere = pic.slots.find((s) => String(s.live_event_id || '') === String(ev.id)
      || (ev.used_in_episode_id && String(s.live_episode_id || '') === String(ev.used_in_episode_id)));
    if (elsewhere) throw new SpecialsError(`"${ev.name}" is E${elsewhere.slot_number}'s: move it from the Roadmap instead.`, 409, 'SEASON_SWAP_REFUSED');
    const own = await specialOfEvent(sequelize, pic.arc.id, ev, { transaction, lock: true });
    if (own?.accepted_at) throw new SpecialsError(`"${ev.name}" is done as ${specialLabel(own)}: it stays where it aired.`, 409, 'SEASON_SWAP_REFUSED');
    if (ev.used_in_episode_id && !own?.episode_id) {
      throw new SpecialsError(`"${ev.name}" has started an episode outside the season: place the episode from the Roadmap.`, 409, 'SEASON_SWAP_REFUSED');
    }
    const replaced = slot.live_event_id ? { id: slot.live_event_id, name: slot.event_name, date: pic.dateOf.get(String(slot.live_event_id)) || null } : null;

    if (own?.episode_id) {
      // Its episode started as a special: the episode moves into the weekly slot, locked to it.
      await sequelize.query(
        'UPDATE season_slots SET episode_id = :episodeId, event_id = :eventId, locked_at = NOW(), updated_at = NOW() WHERE id = :slotId',
        { replacements: { episodeId: own.episode_id, eventId: ev.id, slotId: slot.id }, transaction });
      await unmirror(sequelize, { episodeId: own.episode_id, day: own.release_day, transaction });
      await sequelize.query(
        `UPDATE ${specials.TABLE} SET episode_id = NULL, event_id = NULL, locked_at = NULL, updated_at = NOW() WHERE id = :id`,
        { replacements: { id: own.id }, transaction });
      const { snapshotEpisode } = require('./seasonSlotService');
      await snapshotEpisode(sequelize, { slotId: slot.id, episodeId: own.episode_id, transaction });
    } else {
      // The weekly pencil: the event takes the slot (and leaves its special, which keeps its row for the replaced event).
      const { pencilEventIn } = require('./seasonSlotService');
      await pencilEventIn(sequelize, showId, slot.id, ev.id, transaction);
    }

    let becomes = null;
    if (replaced) {
      const place = placeFor(pic, replaced.date, { slotId: slot.id, eventDate: ev.event_date });
      const rel = releaseFields(place);
      if (own) {
        await sequelize.query(
          `UPDATE ${specials.TABLE} SET kind = 'bonus', special_type = NULL, event_id = :eventId, title = :title, after_slot_number = :after,
                  release_date = CAST(:date AS date), release_time = :time, episode_id = NULL, locked_at = NULL, updated_at = NOW()
            WHERE id = :id`,
          { replacements: { id: own.id, eventId: replaced.id, title: replaced.name, after: place.after, date: rel.date, time: rel.time }, transaction });
        becomes = { id: own.id, label: place.label, after_slot_number: place.after, release: place.release };
      } else {
        const id = await specials.insertSpecial(sequelize, {
          showId, arcId: pic.arc.id, kind: 'bonus', after: place.after, title: replaced.name, eventId: replaced.id, date: rel.date, time: rel.time, transaction,
        });
        becomes = { id, label: place.label, after_slot_number: place.after, release: place.release };
      }
    } else if (own) {
      // Nothing was there to take its special: the empty row is set aside (soft), as Remove does.
      await sequelize.query(`UPDATE ${specials.TABLE} SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id`, { replacements: { id: own.id }, transaction });
    }
    return {
      slot_id: slot.id,
      slot_number: Number(slot.slot_number),
      event: { id: ev.id, name: ev.name },
      replaced: replaced ? { id: replaced.id, name: replaced.name, special: becomes } : null,
    };
  });
}

/** Move a bonus to its story position (its event's date may have arrived since), re-dated midweek there. */
async function moveToStory(sequelize, showId, specialId) {
  const [[sp]] = await sequelize.query(
    `SELECT sp.id, sp.kind, sp.after_slot_number, sp.event_id, sp.accepted_at, ev.event_date, ev.name
       FROM ${specials.TABLE} sp LEFT JOIN world_events ev ON ev.id = sp.event_id AND ev.deleted_at IS NULL
      WHERE sp.id = :specialId AND sp.show_id = :showId AND sp.deleted_at IS NULL`,
    { replacements: { specialId: UUID_RE.test(String(specialId)) ? specialId : null, showId } });
  if (!sp || !specials.KINDS.includes(sp.kind)) throw new SpecialsError('Special not found.', 404, 'SEASON_SPECIAL_NOT_FOUND');
  const pic = await loadPicture(sequelize, showId);
  if (!pic) throw new SpecialsError('Set up the season first.', 409, 'SEASON_NOT_FOUND');
  const place = placeFor(pic, sp.event_date);
  const body = { after_slot_number: place.after };
  if (place.release?.date) Object.assign(body, { release_date: place.release.date, release_time: place.release.time || null });
  await specials.updateSpecial(sequelize, showId, specialId, body);
  return { id: specialId, label: place.label, after_slot_number: place.after, by: place.by, release: place.release };
}

/**
 * Move to the next season instead: the event (or the episode it started as
 * a special) goes into the next season's first open slot, and leaves this
 * season's special or unstarted slot.
 */
async function moveToNextSeason(sequelize, showId, eventId) {
  return sequelize.transaction(async (transaction) => {
    const pic = await activePicture(sequelize, showId, transaction);
    const ev = await eventRow(sequelize, showId, eventId, { transaction, lock: true });
    const next = await nextSeason(sequelize, pic.arc, { transaction });
    if (!next) throw new SpecialsError('There is no next season yet: set it up from the Season page first.', 409, 'SEASON_NEXT_NOT_FOUND');
    if (!next.open_slot_id) throw new SpecialsError(`Season ${next.season_number} has no open episode: every slot has an event or an episode.`, 409, 'SEASON_NEXT_FULL');
    const own = await specialOfEvent(sequelize, pic.arc.id, ev, { transaction, lock: true });
    if (own?.accepted_at) throw new SpecialsError(`"${ev.name}" is done as ${specialLabel(own)}: it stays where it aired.`, 409, 'SEASON_SPECIAL_LOCKED');
    const slotService = require('./seasonSlotService');
    if (own?.episode_id) {
      await sequelize.query(`UPDATE ${specials.TABLE} SET episode_id = NULL, event_id = NULL, deleted_at = NOW(), updated_at = NOW() WHERE id = :id`,
        { replacements: { id: own.id }, transaction });
      await unmirror(sequelize, { episodeId: own.episode_id, day: own.release_day, transaction });
      await slotService.placeEpisodeIn(sequelize, showId, next.open_slot_id, own.episode_id, transaction);
    } else {
      if (ev.used_in_episode_id) throw new SpecialsError(`"${ev.name}" has started an episode: move the episode from the Roadmap.`, 409, 'SEASON_EVENT_NOT_AVAILABLE');
      const here = pic.slots.find((s) => String(s.live_event_id || '') === String(ev.id));
      if (here) {
        const refusal = (here.live_episode_id || here.locked_at) ? `E${here.slot_number} has started.` : pic.twoPart.get(String(here.id)) ? `"${ev.name}" is the two-parter in E${here.slot_number}: undo the two-parter first.` : null;
        if (refusal) throw new SpecialsError(refusal, 409, 'SEASON_EVENT_NOT_AVAILABLE');
        await sequelize.query('UPDATE season_slots SET event_id = NULL, updated_at = NOW() WHERE id = :id', { replacements: { id: here.id }, transaction });
      }
      if (own) await sequelize.query(`UPDATE ${specials.TABLE} SET event_id = NULL, deleted_at = NOW(), updated_at = NOW() WHERE id = :id`, { replacements: { id: own.id }, transaction });
      await slotService.pencilEventIn(sequelize, showId, next.open_slot_id, ev.id, transaction);
    }
    return { season_number: next.season_number, slot_number: next.open_slot_number, label: slotService.episodeLabel(next.season_number, next.open_slot_number) };
  });
}

/**
 * Start Episode on a full season, with the event in no slot and no special
 * (seasonSlotService assignOnStart, when no slot takes it): the episode
 * becomes the special at its suggested position. Returns its label, or null
 * (before the migration, or when the season is not full: today's behaviour).
 */
async function specialOnFullStart(sequelize, { showId, eventId, episodeId, transaction = null }) {
  if (!(await specials.specialsReady(sequelize, { transaction }))) return null;
  const work = async (t) => {
    const pic = await loadPicture(sequelize, showId, { transaction: t });
    if (!pic || !pic.full || !eventId) return null;
    const [[ev]] = await sequelize.query('SELECT id, name, event_date FROM world_events WHERE id = :eventId AND show_id = :showId',
      { replacements: { eventId, showId }, transaction: t });
    if (!ev) return null;
    const place = placeFor(pic, ev.event_date);
    const rel = releaseFields(place);
    await specials.insertSpecial(sequelize, {
      showId, arcId: pic.arc.id, kind: 'bonus', after: place.after, title: ev.name, eventId: ev.id, date: rel.date, time: rel.time, transaction: t,
    });
    return specials.assignSpecialOnStart(sequelize, { showId, eventId: ev.id, episodeId, transaction: t });
  };
  return transaction ? work(transaction) : sequelize.transaction(work);
}

module.exports = {
  isoDay,
  seasonFull,
  storyPosition,
  nearestSwap,
  loadPicture,
  fullChoice,
  makeSpecial,
  swapIntoSlot,
  moveToStory,
  moveToNextSeason,
  specialOnFullStart,
};
