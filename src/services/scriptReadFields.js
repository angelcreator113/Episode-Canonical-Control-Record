'use strict';

/**
 * What the scripts read routes return (GET /api/v1/scripts, /search,
 * /:scriptId and /:scriptId/history; Evoni, 2026-11-21).
 *
 * Those four reads are an ADMIN's (routes/scripts.js). Each answer is built
 * from the names below and nothing else, so a column the table gains later,
 * or one a row happens to carry, is not sent because it is there. The single
 * read used to answer SELECT * when asked for the content.
 *
 * The edit history never carries who it was sent from: `ip_address` and
 * `user_agent` are not in HISTORY_FIELDS.
 *
 *   pick(row, fields)          the row's own values for those names; null for no row
 *   listScript(row)            a row of the list and the search
 *   singleScript(row, { content })   one script; its text only when asked for
 *   historyEntry(row)          one entry of a script's edit history
 */

// A script in the list and the search (services/scriptsService searchScripts).
const SCRIPT_LIST_FIELDS = Object.freeze([
  'id', 'episode_id', 'script_type', 'version_number', 'version_label', 'author', 'status',
  'duration', 'scene_count', 'file_format', 'file_size', 'is_primary', 'is_latest',
  'created_at', 'updated_at', 'episode_title', 'episode_number',
]);

// One script, without its text.
const SCRIPT_FIELDS = Object.freeze([
  'id', 'episode_id', 'script_type', 'version', 'version_number', 'version_label', 'author', 'status',
  'duration', 'scene_count', 'file_format', 'file_url', 'file_size', 'is_primary', 'is_latest',
  'scene_markers', 'created_by', 'created_at', 'updated_at',
]);

// Its text, sent only for ?includeContent=true: `content` is the column this
// service writes; `title`, `script_text` and `script_json` are the script
// writer's names for the same thing (models/EpisodeScript).
const SCRIPT_CONTENT_FIELDS = Object.freeze(['content', 'title', 'script_text', 'script_json']);

// One entry of the edit history. Never ip_address or user_agent.
const HISTORY_FIELDS = Object.freeze(['id', 'script_id', 'user_id', 'edit_type', 'changes', 'created_at']);

function pick(row, fields) {
  if (!row || typeof row !== 'object') return null;
  const out = {};
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
  }
  return out;
}

const listScript = (row) => pick(row, SCRIPT_LIST_FIELDS);
const singleScript = (row, { content = false } = {}) => pick(row, content ? [...SCRIPT_FIELDS, ...SCRIPT_CONTENT_FIELDS] : SCRIPT_FIELDS);
const historyEntry = (row) => pick(row, HISTORY_FIELDS);

module.exports = {
  SCRIPT_LIST_FIELDS, SCRIPT_FIELDS, SCRIPT_CONTENT_FIELDS, HISTORY_FIELDS,
  pick, listScript, singleScript, historyEntry,
};
