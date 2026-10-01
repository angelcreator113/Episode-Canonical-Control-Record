'use strict';

/**
 * Season slots — the Season Arc roadmap (Evoni's rulings, 2026-10-01,
 * docs/EVENT_EPISODE_FLOW.md §8(ff); build PR 1 of
 * docs/SEASON_ARC_DESIGN_NOTE.md).
 *
 *   A2. "A season has 24 episode slots in three phases: Foundation (1–8),
 *   Ascension (9–16), Legacy (17–24). [...] each slot showing its state:
 *   done, in production, event ready, needs an event."
 *   Q3. "Episode numbers restart each season, shown "S1 · E7"; the
 *   show-wide count stays internal."
 *
 *   Q5. "an event can be pencilled into a future slot and moved freely; it
 *   locks at Start Episode."
 *   A5. "Start Episode snapshots the season context onto the episode. The
 *   Overview shows its season position and purpose, and the script
 *   generator receives that context."
 *   A6. "Accepting a completed episode updates the season: it records the
 *   actual outcome on its slot, [...] checks whether a phase boundary is
 *   reached (checkPhaseTransition, currently never called), and readies the
 *   next slot."
 *   Q6. "Ask first: at a phase boundary show a summary of the phase
 *   completed and what changes, and Evoni confirms."
 *   Q7. "Pressure is Low · Medium · High · Peak. Desired is set in the
 *   slot's intention; actual is derived from the evaluation tier, the
 *   episode's money net and the stress change."
 *   A7. "Only future slots can be reordered or re-planned; a slot whose
 *   episode has started is locked to that episode."
 *   Q4 (accepted). Existing episodes in no slot are listed "for you to place
 *   or leave unslotted".
 */

const SLOTS_PER_SEASON = 24;
const DEFAULT_PHASES = [
  { phase: 1, title: 'Foundation', episode_start: 1, episode_end: 8 },
  { phase: 2, title: 'Ascension', episode_start: 9, episode_end: 16 },
  { phase: 3, title: 'Legacy', episode_start: 17, episode_end: 24 },
];

const SLOT_STATES = Object.freeze({
  DONE: 'done',
  IN_PRODUCTION: 'in_production',
  EVENT_READY: 'event_ready',
  NEEDS_EVENT: 'needs_event',
});

class SeasonSlotError extends Error {
  constructor(message, status = 409, code = 'SEASON_SLOT_CONFLICT') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[seasonSlotService] JSON parse failed; default used:', err.message);
    return fallback;
  }
}

function arcPhases(arc) {
  const phases = parseJson(arc?.phases, []);
  return Array.isArray(phases) && phases.length > 0 ? phases : DEFAULT_PHASES;
}

function phaseFor(slot, phases) {
  const match = phases.find((p) => Number(p.episode_start) <= slot && slot <= Number(p.episode_end));
  if (match && Number.isInteger(Number(match.phase))) return Number(match.phase);
  return Math.min(3, Math.ceil(slot / 8));
}

/** "S1 · E7" (Q3): the season and the slot, never the show-wide number. */
function episodeLabel(seasonNumber, slotNumber) {
  return `S${seasonNumber || 1} · E${slotNumber}`;
}

/**
 * A slot's state from its live episode and pencilled event:
 * accepted episode → done; any other live episode → in production;
 * a live event and no episode → event ready; otherwise needs an event.
 */
function slotState({ episode, event }) {
  if (episode) return episode.evaluation_status === 'accepted' ? SLOT_STATES.DONE : SLOT_STATES.IN_PRODUCTION;
  if (event) return SLOT_STATES.EVENT_READY;
  return SLOT_STATES.NEEDS_EVENT;
}

const PRESSURE_LEVELS = ['Low', 'Medium', 'High', 'Peak'];
const TIER_PRESSURE = { slay: 0, pass: 1, safe: 2, fail: 3 };

/**
 * The pressure an episode actually put on Lala (Q7), from its evaluation
 * tier, its money net and her stress change. Points: tier slay 0 · pass 1 ·
 * safe 2 · fail 3; money net below 0 +1, below −1000 +2; stress up by 2 or
 * more +1, by 4 or more +2. Total 0–1 Low, 2–3 Medium, 4–5 High, 6+ Peak.
 */
function derivePressure({ tier, moneyNet = 0, stressDelta = 0 }) {
  let points = TIER_PRESSURE[tier] ?? 1;
  if (moneyNet < -1000) points += 2;
  else if (moneyNet < 0) points += 1;
  if (stressDelta >= 4) points += 2;
  else if (stressDelta >= 2) points += 1;
  if (points >= 6) return 'Peak';
  if (points >= 4) return 'High';
  if (points >= 2) return 'Medium';
  return 'Low';
}

/**
 * Accepting an episode (A6): its slot records the actual outcome and
 * pressure, and the season checks for a phase boundary through
 * checkPhaseTransition, which also moves show_arcs.current_episode to the
 * slot. At a boundary nothing advances: the roadmap asks first (Q6).
 * Returns { slot_number, actual_outcome, actual_pressure, phase_boundary },
 * or null when the episode is in no slot.
 */
async function recordSlotOutcome(sequelize, { showId, episodeId, tier, moneyNet, stressDelta }) {
  const pressure = derivePressure({ tier, moneyNet, stressDelta });
  const [rows] = await sequelize.query(
    `UPDATE season_slots SET actual_outcome = :tier, actual_pressure = :pressure, accepted_at = NOW(), updated_at = NOW()
      WHERE episode_id = :episodeId AND show_id = :showId AND deleted_at IS NULL
      RETURNING slot_number, phase`,
    { replacements: { tier, pressure, episodeId, showId } });
  if (!rows.length) return null;
  const slotNumber = rows[0].slot_number;
  const { checkPhaseTransition } = require('./arcProgressionService');
  const transition = await checkPhaseTransition(showId, slotNumber, { sequelize });
  return {
    slot_number: slotNumber,
    actual_outcome: tier,
    actual_pressure: pressure,
    phase_boundary: transition
      ? { phase: transition.current_phase?.phase, title: transition.current_phase?.title, next_phase: transition.next_phase?.title || null }
      : null,
  };
}

/**
 * A4: the Event Package's read-only Season Context block — the season,
 * phase, slot and purpose an event belongs to: the slot it is pencilled
 * into, or the slot of the episode it started. When it is in no slot, the
 * next open slot is named. Null when the show has no active season.
 */
async function eventSeasonContext(sequelize, showId, eventId) {
  const [[arc]] = await sequelize.query(
    `SELECT id, title, phases, season_number FROM show_arcs
      WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL ORDER BY arc_number ASC LIMIT 1`,
    { replacements: { showId } });
  if (!arc) return null;
  const [[slot]] = await sequelize.query(
    `SELECT s.slot_number, s.season_number, s.phase, s.story_purpose, s.desired_pressure, s.episode_id,
            CASE WHEN s.event_id = :eventId THEN 'pencilled' ELSE 'episode' END AS via
       FROM season_slots s
       LEFT JOIN world_events ev ON ev.id = :eventId
      WHERE s.arc_id = :arcId AND s.deleted_at IS NULL
        AND (s.event_id = :eventId OR (ev.used_in_episode_id IS NOT NULL AND s.episode_id = ev.used_in_episode_id))
      ORDER BY s.slot_number ASC LIMIT 1`,
    { replacements: { arcId: arc.id, eventId } });
  const phases = arcPhases(arc);
  const phaseOf = (n) => {
    const p = phases.find((ph) => Number(ph.phase) === Number(n));
    return p ? { number: Number(p.phase), title: p.title } : { number: n, title: null };
  };
  if (slot) {
    return {
      season_number: slot.season_number || 1,
      arc_title: arc.title,
      in_slot: true,
      via: slot.via,
      label: episodeLabel(slot.season_number, slot.slot_number),
      slot_number: slot.slot_number,
      phase: phaseOf(slot.phase),
      story_purpose: slot.story_purpose || null,
      desired_pressure: slot.desired_pressure || null,
    };
  }
  const [[next]] = await sequelize.query(
    `SELECT slot_number, season_number, phase FROM season_slots
      WHERE arc_id = :arcId AND deleted_at IS NULL AND episode_id IS NULL AND locked_at IS NULL
      ORDER BY slot_number ASC LIMIT 1`,
    { replacements: { arcId: arc.id } });
  return {
    season_number: arc.season_number || 1,
    arc_title: arc.title,
    in_slot: false,
    next_open: next ? { label: episodeLabel(next.season_number, next.slot_number), phase: phaseOf(next.phase) } : null,
  };
}

/** Creates an arc's 24 empty slots when it has none. Returns how many were created. */
async function ensureSeasonSlots(sequelize, arc, { transaction } = {}) {
  const [[{ n }]] = await sequelize.query(
    'SELECT COUNT(*)::int AS n FROM season_slots WHERE arc_id = :arcId AND deleted_at IS NULL',
    { replacements: { arcId: arc.id }, transaction });
  if (n > 0) return 0;
  const phases = arcPhases(arc);
  for (let slot = 1; slot <= SLOTS_PER_SEASON; slot += 1) {
    await sequelize.query(
      `INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, created_at, updated_at)
       VALUES (gen_random_uuid(), :showId, :arcId, :season, :slot, :phase, NOW(), NOW())`,
      { replacements: { showId: arc.show_id, arcId: arc.id, season: arc.season_number || 1, slot, phase: phaseFor(slot, phases) }, transaction });
  }
  return SLOTS_PER_SEASON;
}

/**
 * The active season's roadmap: its phases, each with its slots and their
 * states, plus the show's live episodes that are in no slot (Q4: listed for
 * Evoni to place or leave unslotted). Null when the show has no active arc.
 */
async function getRoadmap(sequelize, showId) {
  const [arcs] = await sequelize.query(
    `SELECT id, show_id, title, tagline, season_number, phases, current_phase
       FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL
      ORDER BY arc_number ASC LIMIT 1`,
    { replacements: { showId } });
  const arc = arcs[0];
  if (!arc) return null;

  const [rows] = await sequelize.query(
    `SELECT s.id, s.slot_number, s.phase, s.season_number, s.locked_at,
            s.story_purpose, s.career_focus, s.desired_pressure, s.outcome_range, s.intention_source,
            s.actual_outcome, s.actual_pressure,
            ep.id AS episode_id, ep.title AS episode_title, ep.status AS episode_status,
            ep.evaluation_status AS episode_evaluation_status,
            ev.id AS event_id, ev.name AS event_name, ev.status AS event_status
       FROM season_slots s
       LEFT JOIN episodes ep ON ep.id = s.episode_id AND ep.deleted_at IS NULL
       LEFT JOIN world_events ev ON ev.id = s.event_id AND ev.deleted_at IS NULL
      WHERE s.arc_id = :arcId AND s.deleted_at IS NULL
      ORDER BY s.slot_number ASC`,
    { replacements: { arcId: arc.id } });

  const seasonNumber = arc.season_number || 1;
  const slots = rows.map((r) => {
    const episode = r.episode_id
      ? { id: r.episode_id, title: r.episode_title, status: r.episode_status, evaluation_status: r.episode_evaluation_status }
      : null;
    const event = r.event_id ? { id: r.event_id, name: r.event_name, status: r.event_status } : null;
    return {
      id: r.id,
      slot_number: r.slot_number,
      phase: r.phase,
      label: episodeLabel(seasonNumber, r.slot_number),
      state: slotState({ episode, event }),
      locked: Boolean(r.locked_at) || Boolean(episode),
      episode,
      event,
      intention: {
        story_purpose: r.story_purpose,
        career_focus: r.career_focus,
        desired_pressure: r.desired_pressure,
        outcome_range: parseJson(r.outcome_range, null),
        source: r.intention_source,
      },
      result: { actual_outcome: r.actual_outcome, actual_pressure: r.actual_pressure },
    };
  });

  const phases = arcPhases(arc).map((p) => ({
    phase: Number(p.phase),
    title: p.title,
    tagline: p.tagline || null,
    status: p.status || null,
    episode_start: Number(p.episode_start),
    episode_end: Number(p.episode_end),
    slots: slots.filter((s) => s.phase === Number(p.phase)),
  }));

  const [unslotted] = await sequelize.query(
    `SELECT ep.id, ep.title, ep.episode_number, ep.status, ep.evaluation_status
       FROM episodes ep
      WHERE ep.show_id = :showId AND ep.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM season_slots s WHERE s.episode_id = ep.id AND s.deleted_at IS NULL)
      ORDER BY ep.episode_number ASC NULLS LAST, ep.created_at ASC`,
    { replacements: { showId } });

  // Events that can be pencilled (Q5): live, unused, not archived, and not
  // already in a slot of this season.
  const [availableEvents] = await sequelize.query(
    `SELECT ev.id, ev.name, ev.status
       FROM world_events ev
      WHERE ev.show_id = :showId AND ev.deleted_at IS NULL AND ev.used_in_episode_id IS NULL
        AND COALESCE(ev.status, 'draft') IN ('draft', 'ready')
        AND NOT EXISTS (SELECT 1 FROM season_slots s WHERE s.event_id = ev.id AND s.arc_id = :arcId AND s.deleted_at IS NULL)
      ORDER BY ev.name ASC`,
    { replacements: { showId, arcId: arc.id } });

  // The next slot to fill (A6 "readies the next slot"): the earliest slot
  // with no episode.
  const nextSlot = slots.find((sl) => !sl.episode);

  // A phase boundary (Q6, ask first): every slot of the current phase is
  // done and the phase is still active. The summary says what the phase
  // did and what advancing changes; advancing stays Evoni's action.
  let phaseBoundary = null;
  const current = phases.find((p) => p.phase === Number(arc.current_phase));
  if (current && current.status !== 'completed' && current.slots.length > 0
      && current.slots.every((sl) => sl.state === SLOT_STATES.DONE)) {
    const outcomes = current.slots.reduce((acc, sl) => {
      const tier = sl.result.actual_outcome || 'unknown';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {});
    const next = phases.find((p) => p.phase === current.phase + 1) || null;
    let goals = null;
    try {
      const { getPhaseGoalStatus } = require('./arcProgressionService');
      const status = await getPhaseGoalStatus(showId, current, { sequelize });
      goals = { total: status.total, completed: status.completed, unmet: status.active_remaining, warning: status.warning_message || null };
    } catch (err) {
      console.error('[seasonSlotService] phase goal status failed:', err.message);
    }
    phaseBoundary = {
      phase: current.phase,
      title: current.title,
      next_phase: next ? { phase: next.phase, title: next.title, tagline: next.tagline } : null,
      outcomes,
      goals,
    };
  }

  const counts = Object.values(SLOT_STATES).reduce((acc, state) => {
    acc[state] = slots.filter((s) => s.state === state).length;
    return acc;
  }, {});

  return {
    arc: { id: arc.id, title: arc.title, tagline: arc.tagline, current_phase: arc.current_phase },
    season_number: seasonNumber,
    slot_count: slots.length,
    counts,
    phases,
    unslotted_episodes: unslotted,
    available_events: availableEvents,
    next_slot_number: nextSlot ? nextSlot.slot_number : null,
    phase_boundary: phaseBoundary,
  };
}

/**
 * The season context snapshotted onto an episode (A5): the slot's season,
 * label, phase and intention. Also sets episodes.season_number and fills the
 * brief's arc_number (the phase) and position_in_arc (the slot within the
 * phase) where they are empty, so the grounded script reads them.
 */
async function snapshotEpisode(sequelize, { slotId, episodeId, transaction }) {
  const [[slot]] = await sequelize.query(
    `SELECT s.slot_number, s.season_number, s.phase, s.story_purpose, s.career_focus, s.desired_pressure,
            s.outcome_range, a.id AS arc_id, a.title AS arc_title, a.phases
       FROM season_slots s JOIN show_arcs a ON a.id = s.arc_id
      WHERE s.id = :slotId`,
    { replacements: { slotId }, transaction });
  if (!slot) return null;
  const phase = arcPhases(slot).find((p) => Number(p.phase) === Number(slot.phase)) || {};
  const start = Number(phase.episode_start) || ((slot.phase - 1) * 8 + 1);
  const season = slot.season_number || 1;
  const context = {
    season_number: season,
    label: episodeLabel(season, slot.slot_number),
    slot_number: slot.slot_number,
    arc_id: slot.arc_id,
    arc_title: slot.arc_title,
    phase: {
      number: slot.phase,
      title: phase.title || null,
      tagline: phase.tagline || null,
      emotional_arc: phase.emotional_arc || null,
    },
    position_in_phase: slot.slot_number - start + 1,
    story_purpose: slot.story_purpose || null,
    career_focus: slot.career_focus || null,
    desired_pressure: slot.desired_pressure || null,
    outcome_range: parseJson(slot.outcome_range, null),
    snapshotted_at: new Date().toISOString(),
  };
  await sequelize.query(
    `UPDATE episodes SET season_context = CAST(:context AS jsonb), season_number = :season, updated_at = NOW()
      WHERE id = :episodeId`,
    { replacements: { context: JSON.stringify(context), season, episodeId }, transaction });
  await sequelize.query(
    `UPDATE episode_briefs
        SET arc_number = COALESCE(arc_number, :phase), position_in_arc = COALESCE(position_in_arc, :position)
      WHERE episode_id = :episodeId AND deleted_at IS NULL`,
    { replacements: { phase: slot.phase, position: context.position_in_phase, episodeId }, transaction });
  // Q10: the slot's outcome range sets the brief's designed intent and
  // allowed outcomes, so the slot is the one source.
  const { outcomeRangeToBrief } = require('./seasonIntentionService');
  const fromRange = outcomeRangeToBrief(context.outcome_range);
  if (fromRange) {
    await sequelize.query(
      `UPDATE episode_briefs SET designed_intent = :intent, allowed_outcomes = CAST(:allowed AS jsonb)
        WHERE episode_id = :episodeId AND deleted_at IS NULL`,
      { replacements: { intent: fromRange.designed_intent, allowed: JSON.stringify(fromRange.allowed_outcomes), episodeId }, transaction });
  }
  return context;
}

async function lockSlot(sequelize, showId, slotId, transaction) {
  const [[slot]] = await sequelize.query(
    `SELECT id, arc_id, slot_number, event_id, episode_id, locked_at
       FROM season_slots WHERE id = :slotId AND show_id = :showId AND deleted_at IS NULL FOR UPDATE`,
    { replacements: { slotId, showId }, transaction });
  if (!slot) throw new SeasonSlotError('Slot not found', 404, 'SEASON_SLOT_NOT_FOUND');
  return slot;
}

function assertFuture(slot) {
  if (slot.episode_id || slot.locked_at) {
    throw new SeasonSlotError(`E${slot.slot_number} has started: it is locked to its episode`, 409, 'SEASON_SLOT_LOCKED');
  }
}

/**
 * Pencils an event into a future slot, or clears it (eventId null) (Q5).
 * The event moves freely: pencilling it here takes it out of any other slot
 * of the season. An event already in this slot is replaced and returned.
 */
async function pencilEvent(sequelize, showId, slotId, eventId) {
  return sequelize.transaction(async (transaction) => {
    const slot = await lockSlot(sequelize, showId, slotId, transaction);
    assertFuture(slot);
    const replaced = slot.event_id && slot.event_id !== eventId ? slot.event_id : null;
    let movedFrom = null;

    if (eventId) {
      const [[event]] = await sequelize.query(
        `SELECT id, name, status, used_in_episode_id FROM world_events
          WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL`,
        { replacements: { eventId, showId }, transaction });
      if (!event) throw new SeasonSlotError('Event not found for this show', 404, 'SEASON_EVENT_NOT_FOUND');
      if (event.used_in_episode_id || !['draft', 'ready'].includes(event.status || 'draft')) {
        throw new SeasonSlotError(`"${event.name}" has started an episode or is archived; only a draft or ready event can be pencilled`, 409, 'SEASON_EVENT_NOT_AVAILABLE');
      }
      const [[other]] = await sequelize.query(
        `SELECT id, slot_number FROM season_slots
          WHERE arc_id = :arcId AND event_id = :eventId AND id <> :slotId AND deleted_at IS NULL FOR UPDATE`,
        { replacements: { arcId: slot.arc_id, eventId, slotId }, transaction });
      if (other) {
        await sequelize.query('UPDATE season_slots SET event_id = NULL, updated_at = NOW() WHERE id = :id',
          { replacements: { id: other.id }, transaction });
        movedFrom = other.slot_number;
      }
    }

    await sequelize.query('UPDATE season_slots SET event_id = :eventId, updated_at = NOW() WHERE id = :slotId',
      { replacements: { eventId: eventId || null, slotId }, transaction });
    return { slot_number: slot.slot_number, event_id: eventId || null, moved_from: movedFrom, replaced_event_id: replaced };
  });
}

/**
 * Places an existing episode that is in no slot into an open slot, and locks
 * the slot to it (Q4, A7). The slot keeps the episode's own event, if any.
 */
async function placeEpisode(sequelize, showId, slotId, episodeId) {
  return sequelize.transaction(async (transaction) => {
    const slot = await lockSlot(sequelize, showId, slotId, transaction);
    assertFuture(slot);
    const [[episode]] = await sequelize.query(
      'SELECT id, title FROM episodes WHERE id = :episodeId AND show_id = :showId AND deleted_at IS NULL',
      { replacements: { episodeId, showId }, transaction });
    if (!episode) throw new SeasonSlotError('Episode not found for this show', 404, 'SEASON_EPISODE_NOT_FOUND');
    const [[placed]] = await sequelize.query(
      'SELECT slot_number FROM season_slots WHERE episode_id = :episodeId AND deleted_at IS NULL',
      { replacements: { episodeId }, transaction });
    if (placed) throw new SeasonSlotError(`"${episode.title}" is already in E${placed.slot_number}`, 409, 'SEASON_EPISODE_PLACED');

    const [[event]] = await sequelize.query(
      'SELECT id FROM world_events WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId }, transaction });
    const eventId = event ? event.id : null;
    if (eventId) {
      await sequelize.query(
        `UPDATE season_slots SET event_id = NULL, updated_at = NOW()
          WHERE arc_id = :arcId AND event_id = :eventId AND id <> :slotId AND deleted_at IS NULL`,
        { replacements: { arcId: slot.arc_id, eventId, slotId }, transaction });
    }
    await sequelize.query(
      `UPDATE season_slots SET episode_id = :episodeId, event_id = :eventId, locked_at = NOW(), updated_at = NOW()
        WHERE id = :slotId`,
      { replacements: { episodeId, eventId, slotId }, transaction });
    await snapshotEpisode(sequelize, { slotId, episodeId, transaction });
    return { slot_number: slot.slot_number, episode_id: episodeId, event_id: eventId };
  });
}

/**
 * Start Episode (Q5: "it locks at Start Episode"). Called by
 * generateEpisodeFromEvent once the episode is committed (a transaction is
 * optional):
 *   - a regenerate moves the replaced episode's slot to the new episode;
 *   - else the slot the event is pencilled into takes the episode;
 *   - else the earliest open slot (no episode, no pencilled event) does.
 * The slot is locked. Returns the slot number, or null when the show has no
 * active season or no open slot.
 */
async function assignOnStart(sequelize, { showId, eventId, episodeId, replacingEpisodeId = null, transaction }) {
  if (replacingEpisodeId) {
    const [rows] = await sequelize.query(
      `UPDATE season_slots SET episode_id = :episodeId, updated_at = NOW()
        WHERE episode_id = :replacingEpisodeId AND deleted_at IS NULL RETURNING id, slot_number`,
      { replacements: { episodeId, replacingEpisodeId }, transaction });
    if (rows.length) {
      await snapshotEpisode(sequelize, { slotId: rows[0].id, episodeId, transaction });
      return rows[0].slot_number;
    }
  }
  const [[arc]] = await sequelize.query(
    `SELECT id FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL
      ORDER BY arc_number ASC LIMIT 1`,
    { replacements: { showId }, transaction });
  if (!arc) return null;
  const [[slot]] = await sequelize.query(
    `SELECT id, slot_number FROM season_slots
      WHERE arc_id = :arcId AND deleted_at IS NULL AND episode_id IS NULL AND locked_at IS NULL
        AND (event_id = :eventId OR event_id IS NULL)
      ORDER BY (event_id = :eventId) DESC NULLS LAST, slot_number ASC
      LIMIT 1 FOR UPDATE`,
    { replacements: { arcId: arc.id, eventId }, transaction });
  if (!slot) return null;
  await sequelize.query(
    `UPDATE season_slots SET episode_id = :episodeId, event_id = :eventId, locked_at = NOW(), updated_at = NOW()
      WHERE id = :id`,
    { replacements: { episodeId, eventId, id: slot.id }, transaction });
  await snapshotEpisode(sequelize, { slotId: slot.id, episodeId, transaction });
  return slot.slot_number;
}

module.exports = {
  SLOTS_PER_SEASON,
  SLOT_STATES,
  episodeLabel,
  slotState,
  SeasonSlotError,
  ensureSeasonSlots,
  getRoadmap,
  eventSeasonContext,
  pencilEvent,
  placeEpisode,
  assignOnStart,
  snapshotEpisode,
  PRESSURE_LEVELS,
  derivePressure,
  recordSlotOutcome,
};
