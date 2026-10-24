'use strict';

/**
 * One read of "the season": the show's active arc and its slots (planner
 * PR 4, 2026-10-24). The slot service, the twists, the reveal plan, the
 * proposals, the intention drafter and the season setup each used to query
 * the arc and its slots themselves, with their own JSON parsing (and the
 * proposals with no ORDER BY). They read it here.
 *
 *   loadSeason(sequelize, showId, options) → { arc, slots } | null
 *
 * arc     every show_arcs column; `phases` parsed to an array ([] when
 *         unreadable; arcPhases still supplies the defaults where a reader
 *         wants them)
 * slots   ordered by slot_number. Each carries its own season_slots
 *         columns as stored (episode_id and event_id are the slot's raw
 *         links), plus what they join to while it is live:
 *         live_episode_id, episode_title, episode_status,
 *         episode_evaluation_status, episode_number; live_event_id,
 *         event_name, event_status; thread_id, thread_title, thread_status.
 *
 * Options:
 *   transaction   run inside the caller's transaction
 *   lock          FOR UPDATE on the arc and the slots (an edit)
 *   arcId         this arc rather than the show's active one (a slot's own arc)
 *   anyStatus     the active arc, else the show's first by arc_number (the
 *                 twists and the reveal plan read a finished season too)
 *   slots: false  the arc only
 *   scripts       the slot episode's script_content and script_locked_beats too
 */

function parsePhases(value) {
  if (value == null) return [];
  if (typeof value !== 'string') return Array.isArray(value) ? value : [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[seasonLoader] the arc\'s phases could not be read; none used:', err.message);
    return [];
  }
}

async function loadArc(sequelize, showId, { transaction, lock = false, arcId = null, anyStatus = false } = {}) {
  let sql;
  if (arcId) {
    sql = 'SELECT * FROM show_arcs WHERE id = :arcId';
  } else if (anyStatus) {
    sql = `SELECT * FROM show_arcs WHERE show_id = :showId AND deleted_at IS NULL
            ORDER BY (status = 'active') DESC, arc_number ASC LIMIT 1`;
  } else {
    sql = `SELECT * FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL
            ORDER BY arc_number ASC LIMIT 1`;
  }
  const [rows] = await sequelize.query(`${sql}${lock ? ' FOR UPDATE' : ''}`, { replacements: { showId, arcId }, transaction });
  const arc = rows[0];
  if (!arc) return null;
  return { ...arc, phases: parsePhases(arc.phases) };
}

async function loadSlots(sequelize, arcId, { transaction, lock = false, scripts = false } = {}) {
  const [rows] = await sequelize.query(
    `SELECT s.id, s.show_id, s.arc_id, s.season_number, s.slot_number, s.phase, s.episode_id, s.event_id, s.locked_at,
            s.story_purpose, s.story_purposes, s.story_thread_id, s.career_focus, s.desired_pressure, s.outcome_range,
            s.intention_source, s.actual_outcome, s.actual_pressure, s.accepted_at,
            ep.id AS live_episode_id, ep.title AS episode_title, ep.status AS episode_status,
            ep.evaluation_status AS episode_evaluation_status, ep.episode_number,
            ${scripts ? 'ep.script_content, ep.script_locked_beats,' : ''}
            ev.id AS live_event_id, ev.name AS event_name, ev.status AS event_status,
            st.id AS thread_id, st.title AS thread_title, st.status AS thread_status
       FROM season_slots s
       LEFT JOIN episodes ep ON ep.id = s.episode_id AND ep.deleted_at IS NULL
       LEFT JOIN world_events ev ON ev.id = s.event_id AND ev.deleted_at IS NULL
       LEFT JOIN show_story_threads st ON st.id = s.story_thread_id AND st.deleted_at IS NULL
      WHERE s.arc_id = :arcId AND s.deleted_at IS NULL
      ORDER BY s.slot_number ASC${lock ? ' FOR UPDATE OF s' : ''}`,
    { replacements: { arcId }, transaction });
  return rows;
}

/** The season: its arc and its slots; null when the show has none. */
async function loadSeason(sequelize, showId, options = {}) {
  const arc = await loadArc(sequelize, showId, options);
  if (!arc) return null;
  const slots = options.slots === false ? [] : await loadSlots(sequelize, arc.id, options);
  return { arc, slots };
}

module.exports = { loadSeason, parsePhases };
