/**
 * Guards for the legacy Timeline Editor's save (POST /api/v1/episodes/:id/save).
 * Pure: no database, no clock (Timeline Editor redesign P0, 2026-11-02).
 *
 * Two rules keep a save from destroying what the editor never loaded:
 *
 * 1. Scenes are removed only by name. A save soft-deletes only the scenes
 *    listed in `removed_scene_ids` (the editor sends the ids it loaded or
 *    saved and no longer has). A live scene the save neither sends nor names
 *    is left alone, so an editor whose scene list failed to load, or loaded
 *    empty, can never delete the episode's scenes. A save that sends no
 *    scenes and would leave none of the episode's own scenes is refused
 *    unless it says so with `confirm_remove_all`.
 *
 * 2. The timeline row is written only from what was read. A save that
 *    writes the timeline must send `timeline_basis`, the fingerprint of the
 *    row it loaded (GET /timeline-data returns it as `basis`). When the row
 *    holds anything and the fingerprint differs or is missing, the save is
 *    refused, so empty beats and markers from a failed load, or a stale
 *    tab, never replace the stored ones.
 */
const crypto = require('crypto');

const TIMELINE_FIELDS = ['beats', 'markers', 'audio_clips', 'character_clips', 'keyframes'];

/** JSON with object keys sorted, so the fingerprint ignores key order. */
function stableJson(v) {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v === undefined ? null : v);
}

const listOf = (v) => (Array.isArray(v) ? v : []);

/** The fingerprint of a timeline_data row's content (null: no row). */
function timelineBasis(record) {
  if (!record) return null;
  const content = TIMELINE_FIELDS.map((f) => listOf(record[f]));
  return crypto.createHash('sha256').update(stableJson(content)).digest('hex');
}

/** True when the stored row holds any beat, marker, clip or keyframe. */
function timelineHasContent(record) {
  return Boolean(record) && TIMELINE_FIELDS.some((f) => listOf(record[f]).length > 0);
}

class SaveConflict extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/**
 * Refuses a timeline write that was not made from the stored row.
 * Throws SaveConflict; returns nothing when the write may go ahead.
 */
function checkTimelineWrite(record, sentBasis) {
  if (!timelineHasContent(record)) return;
  const current = timelineBasis(record);
  if (sentBasis == null || sentBasis === '') {
    throw new SaveConflict(409, 'TIMELINE_BASIS_MISSING',
      'This save did not come from a loaded timeline, so it cannot replace the stored beats and markers. Reload the editor.',
      { timeline_basis: current });
  }
  if (String(sentBasis) !== current) {
    throw new SaveConflict(409, 'TIMELINE_CHANGED',
      'The timeline changed since this editor loaded it. Reload the editor.',
      { timeline_basis: current });
  }
}

/**
 * Which live scenes a save removes: only those it names in removedIds, that
 * it does not also keep, and that are not a beat's scene (scene_plan_id).
 * Refuses a save that sends no scenes and would leave the episode with none
 * of its own scenes, unless confirmRemoveAll.
 *
 * @param {Array<{id, scene_plan_id}>} existing  the episode's live scenes
 * @param {Set<string>} keptIds                  ids the save updated or created
 * @param {Array} removedIds                     the save's removed_scene_ids
 * @param {number} sentCount                     how many scenes the save sent
 */
function scenesToRemove(existing, keptIds, removedIds, sentCount, confirmRemoveAll = false) {
  const named = new Set(listOf(removedIds).map(String));
  const kept = new Set([...keptIds].map(String));
  const removable = existing.filter((row) => !row.scene_plan_id);
  const removed = removable.filter((row) => named.has(String(row.id)) && !kept.has(String(row.id)));
  if (sentCount === 0 && removable.length > 0 && removed.length === removable.length && !confirmRemoveAll) {
    throw new SaveConflict(409, 'SAVE_WOULD_REMOVE_ALL_SCENES',
      "This save sends no scenes and would remove all of the episode's scenes. Nothing was saved.");
  }
  return removed;
}

module.exports = {
  TIMELINE_FIELDS, stableJson, timelineBasis, timelineHasContent, checkTimelineWrite, scenesToRemove, SaveConflict,
};
