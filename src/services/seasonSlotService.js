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
 * Read-only here, apart from creating a new season's empty slots.
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
  };
}

module.exports = {
  SLOTS_PER_SEASON,
  SLOT_STATES,
  episodeLabel,
  slotState,
  ensureSeasonSlots,
  getRoadmap,
};
