'use strict';

const { episodeEventIdSql } = require('../utils/episodeEventSql');

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
 *   anyStatus     the active arc, else the show's latest by arc_number (the
 *                 twists and the reveal plan read a finished season too;
 *                 after Season 2 it read Season 1, 2026-10-25)
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
            ORDER BY (status = 'active') DESC, arc_number DESC LIMIT 1`;
  } else {
    sql = `SELECT * FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL
            ORDER BY arc_number ASC LIMIT 1`;
  }
  const [rows] = await sequelize.query(`${sql}${lock ? ' FOR UPDATE' : ''}`, { replacements: { showId, arcId }, transaction });
  const arc = rows[0];
  if (!arc) return null;
  return { ...arc, phases: parsePhases(arc.phases) };
}

/**
 * The event a slot shows, derived on read (Evoni, 2026-11-12). Nothing is
 * written: season_slots.event_id stays the pencil, and is the event only
 * while the slot is empty.
 *
 *   empty slot                     its pencilled event            source 'pencil' (or 'none')
 *   occupied slot                  its episode's canonical event  source 'episode'
 *   occupied, episode has no event none                           source 'none'
 *
 * needs_review: the episode's event and the links disagree. Its reasons:
 *   primary_link_missing      the event's own link does not point at this episode
 *   primary_linked_elsewhere  the event's own link points at another live episode
 *                             (a two-parter's other part is not this)
 *   other_event_linked        with either of those, another event's link points here
 * pencil_disagrees: the slot still stores a pencilled event that is not the
 * episode's event. The pencil is kept as it is (pencilled_event) and flagged.
 *
 * `row` is one loadSlots row. Pure.
 */
function slotEventView(row) {
  const truthy = (v) => v === true || v === 't' || v === 1;
  const pencil = row.live_event_id ? { id: row.live_event_id, name: row.event_name, status: row.event_status } : null;
  if (!row.live_episode_id) {
    return { event: pencil, source: pencil ? 'pencil' : 'none', pencilled_event: pencil, needs_review: false, review_reasons: [], pencil_disagrees: false };
  }
  const primary = row.primary_event_id ? { id: row.primary_event_id, name: row.primary_event_name, status: row.primary_event_status } : null;
  const reasons = [];
  if (primary && !truthy(row.primary_event_linked_here) && !truthy(row.primary_event_two_part)) {
    reasons.push(truthy(row.primary_event_linked_elsewhere) ? 'primary_linked_elsewhere' : 'primary_link_missing');
    if (Number(row.other_linked_events) > 0) reasons.push('other_event_linked');
  }
  // The pencil is compared by the stored id, so a pencil naming a deleted event is flagged too.
  const pencilDisagrees = Boolean(row.event_id) && String(row.event_id) !== String(primary?.id || '');
  return {
    event: primary,
    source: primary ? 'episode' : 'none',
    pencilled_event: pencil,
    needs_review: reasons.length > 0,
    review_reasons: reasons,
    pencil_disagrees: pencilDisagrees,
  };
}

async function loadSlots(sequelize, arcId, { transaction, lock = false, scripts = false } = {}) {
  // A1.3-0 (C4b): an edit locks the season's slots in id order, the one order
  // for every multi-slot lock (Start's pick and pencil take the same), then
  // reads them in slot order as before. The rows read are the locked rows.
  if (lock) {
    await sequelize.query(
      'SELECT id FROM season_slots WHERE arc_id = :arcId AND deleted_at IS NULL ORDER BY id FOR UPDATE',
      { replacements: { arcId }, transaction });
  }
  const [rows] = await sequelize.query(
    `SELECT s.id, s.show_id, s.arc_id, s.season_number, s.slot_number, s.phase, s.episode_id, s.event_id, s.locked_at,
            s.story_purpose, s.story_purposes, s.story_thread_id, s.career_focus, s.desired_pressure, s.outcome_range,
            s.intention_source, s.actual_outcome, s.actual_pressure, s.accepted_at,
            ep.id AS live_episode_id, ep.title AS episode_title, ep.status AS episode_status,
            ep.evaluation_status AS episode_evaluation_status, ep.episode_number,
            ${scripts ? 'ep.script_content, ep.script_locked_beats,' : ''}
            ev.id AS live_event_id, ev.name AS event_name, ev.status AS event_status,
            -- Derived, read-only (Evoni, 2026-11-12): an occupied slot's event is its
            -- episode's canonical event (utils/episodeEventSql), never copied back into
            -- s.event_id. The columns above stay the raw pencil; these sit beside them.
            pev.id AS primary_event_id, pev.name AS primary_event_name, pev.status AS primary_event_status,
            (pev.id IS NOT NULL AND pev.used_in_episode_id = ep.id) AS primary_event_linked_here,
            (pev.id IS NOT NULL AND EXISTS (
               SELECT 1 FROM episodes e2
                 JOIN episode_briefs b2 ON b2.episode_id = e2.id AND b2.deleted_at IS NULL AND b2.event_id = pev.id
                WHERE e2.id = pev.used_in_episode_id AND e2.deleted_at IS NULL AND e2.id <> ep.id)) AS primary_event_two_part,
            (pev.id IS NOT NULL AND EXISTS (
               SELECT 1 FROM episodes e3 WHERE e3.id = pev.used_in_episode_id AND e3.deleted_at IS NULL AND e3.id <> ep.id)) AS primary_event_linked_elsewhere,
            (SELECT count(*) FROM world_events o
              WHERE ep.id IS NOT NULL AND o.used_in_episode_id = ep.id AND o.deleted_at IS NULL
                AND o.id IS DISTINCT FROM pev.id) AS other_linked_events,
            st.id AS thread_id, st.title AS thread_title, st.status AS thread_status
       FROM season_slots s
       LEFT JOIN episodes ep ON ep.id = s.episode_id AND ep.deleted_at IS NULL
       LEFT JOIN world_events ev ON ev.id = s.event_id AND ev.deleted_at IS NULL
       LEFT JOIN world_events pev ON ep.id IS NOT NULL AND pev.deleted_at IS NULL AND pev.id = ${episodeEventIdSql('ep.id')}
       LEFT JOIN show_story_threads st ON st.id = s.story_thread_id AND st.deleted_at IS NULL
      WHERE s.arc_id = :arcId AND s.deleted_at IS NULL
      ORDER BY s.slot_number ASC`,
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

module.exports = { loadSeason, parsePhases, slotEventView };
