'use strict';

/**
 * What an episode read answers a reader who is not an admin (GET
 * /api/v1/episodes and /:id; Evoni, 2026-11-22: "Non-admin accounts must
 * not receive internal script text at any status." and "returning only
 * approved safe fields").
 *
 * An ADMIN gets the row as before. Anyone else gets the names below and
 * nothing else, so a column the table gains later, or one a row happens to
 * carry, is not sent because it is there. Not among them: the script
 * (script_content, script_locked_beats, the script revision), the internal
 * synopsis (description), the evaluation, the money columns, the setup
 * record, the distribution copy, the title card and overlay columns and the
 * teaser's saved draft.
 *
 * The viewer copy is `teaser` (models/Episode: "the viewer-facing copy is
 * `teaser`"); nothing is written in the synopsis's place.
 *
 * Three facts about the script are worked out here from the row, so the
 * boards still say whether there is one without being sent its words:
 *   has_script                   there is script text
 *   script_approved_beat_count   the beats approved on the Script tab
 *   script_line_count            its lines
 *
 *   pick(row, fields)            the row's own values for those names; null for no row
 *   episodeForReader(user, row)  the row for an ADMIN; the named fields for anyone else
 *   EPISODE_NESTED_FIELDS        an episode inside another answer, for every reader
 */

const { userInGroup } = require('../middleware/auth');

// An episode as a non-admin reads it.
const EPISODE_SAFE_FIELDS = Object.freeze([
  'id', 'episode_number', 'season_number', 'title', 'air_date', 'status', 'categories', 'show_id',
  'thumbnail_url', 'platform', 'width', 'height', 'aspect_ratio', 'teaser', 'season_context',
  'created_at', 'updated_at',
]);

// The columns the three script facts are worked out from. Read, never sent.
const EPISODE_SCRIPT_SOURCE_FIELDS = Object.freeze(['script_content', 'script_locked_beats']);

// What the list selects for a non-admin: the safe fields and those sources.
const EPISODE_READER_QUERY_FIELDS = Object.freeze([...EPISODE_SAFE_FIELDS, ...EPISODE_SCRIPT_SOURCE_FIELDS]);

// The episode's show, as both reads already include it.
const EPISODE_SHOW_FIELDS = Object.freeze(['id', 'name', 'icon', 'color']);

// An episode included in another answer (a composition, a decision, a scene,
// the footage link): what names it, for every reader, admins too.
const EPISODE_NESTED_FIELDS = Object.freeze(['id', 'title', 'episode_number', 'season_number', 'status', 'show_id']);

// season_context is the snapshot Start Episode writes (services/
// seasonSlotService snapshotEpisode, services/seasonSpecials). Beside where
// the episode sits it carries the season's planning text: arc_title,
// arc_tagline, arc_logline, arc_description, the phase's title, tagline and
// emotional_arc, story_purpose(s), career_focus, desired_pressure,
// outcome_range, story_thread. A non-admin gets only where it sits: the
// label and the season, slot, phase and special identifiers the boards read
// (frontend lib/episodePipeline, lib/episodePlace, lib/seasonSpecials,
// lib/seasonAttention).
const SEASON_CONTEXT_FIELDS = Object.freeze([
  'label', 'season_number', 'slot_number', 'arc_id', 'phase_count', 'position_in_phase', 'snapshotted_at',
]);
const SEASON_PHASE_FIELDS = Object.freeze(['number', 'episode_start', 'episode_end']);
const SEASON_TWO_PART_FIELDS = Object.freeze(['part', 'of', 'other_slot_number', 'label']);
const SEASON_SPECIAL_FIELDS = Object.freeze(['id', 'kind', 'special_type', 'after_slot_number', 'label', 'counts_toward_parts']);

// The beats of an episode (utils/scriptBeatLocks BEAT_COUNT; frontend lib/productionSteps SCENE_COUNT).
const BEAT_COUNT = 14;

function pick(row, fields) {
  if (!row || typeof row !== 'object') return null;
  const out = {};
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
  }
  return out;
}

/** A row as plain values, whether it came as a model instance or as an object. */
function plain(row) {
  if (!row || typeof row !== 'object') return null;
  return typeof row.get === 'function' ? row.get({ plain: true }) : row;
}

/** JSON text or a value, as a plain object; null for anything else. */
function asObject(value) {
  let v = value;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch (err) { console.error('[episodeReadFields] a JSON column could not be read:', err.message); return null; }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

/** Where the episode sits in its season, without the season's planning text. */
function safeSeasonContext(value) {
  const sc = asObject(value);
  if (!sc) return null;
  const out = pick(sc, SEASON_CONTEXT_FIELDS);
  for (const [key, fields] of [['phase', SEASON_PHASE_FIELDS], ['two_part', SEASON_TWO_PART_FIELDS], ['special', SEASON_SPECIAL_FIELDS]]) {
    if (!Object.prototype.hasOwnProperty.call(sc, key)) continue;
    const part = asObject(sc[key]);
    out[key] = part ? pick(part, fields) : null;
  }
  return out;
}

/** The three script facts, by the rules the pages used on the text itself. */
function scriptFacts(row) {
  const text = typeof row.script_content === 'string' ? row.script_content : '';
  const hasScript = Boolean(text.trim());
  // As frontend lib/productionSteps approvedBeats counts them.
  let locked = row.script_locked_beats;
  if (typeof locked === 'string') {
    try { locked = JSON.parse(locked); } catch (err) { console.error('[episodeReadFields] script_locked_beats unreadable:', err.message); locked = []; }
  }
  const approved = new Set((Array.isArray(locked) ? locked : []).map(Number).filter((n) => n >= 1 && n <= BEAT_COUNT));
  return {
    has_script: hasScript,
    script_approved_beat_count: approved.size,
    // As Producer Mode's ledger counted them (components/Show/EpisodeLedger).
    script_line_count: hasScript ? text.split('\n').length : 0,
  };
}

/** An episode as a non-admin reads it: the safe fields, its show and the script facts. */
function safeEpisode(row) {
  const values = plain(row);
  if (!values) return null;
  const out = {};
  for (const key of EPISODE_SAFE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
    // The season snapshot is sent as where the episode sits, never whole.
    out[key] = key === 'season_context' ? safeSeasonContext(values[key]) : values[key];
  }
  if (values.show !== undefined) out.show = pick(plain(values.show), EPISODE_SHOW_FIELDS);
  return { ...out, ...scriptFacts(values) };
}

/** The row itself for an ADMIN (as before); the named fields for anyone else. */
const episodeForReader = (user, row) => (userInGroup(user, 'ADMIN') || !row ? row : safeEpisode(row));

module.exports = {
  EPISODE_SAFE_FIELDS, EPISODE_SCRIPT_SOURCE_FIELDS, EPISODE_READER_QUERY_FIELDS, EPISODE_SHOW_FIELDS,
  EPISODE_NESTED_FIELDS, SEASON_CONTEXT_FIELDS, SEASON_PHASE_FIELDS, SEASON_TWO_PART_FIELDS, SEASON_SPECIAL_FIELDS,
  pick, safeSeasonContext, scriptFacts, safeEpisode, episodeForReader,
};
