/**
 * What a page may know about an episode's script without holding its text.
 *
 * An admin's episode still carries the script (script_content,
 * script_locked_beats). Anyone else's carries three facts the server works
 * out instead (src/services/episodeReadFields.js; Evoni, 2026-11-22):
 * has_script, script_approved_beat_count, script_line_count. Each helper
 * reads the text when the episode has it, by the rule the page already
 * used, and the fact when it does not. Pure; no I/O.
 */

/** There is script text: the text itself (trimmed) when sent, else the server's has_script. */
export function hasScript(episode) {
  if (typeof episode?.script_content === 'string') return Boolean(episode.script_content.trim());
  return episode?.has_script === true;
}

/** The script's lines: counted from the text when sent, else the server's script_line_count. */
export function scriptLineCount(episode) {
  if (typeof episode?.script_content === 'string') return episode.script_content.split('\n').length;
  const n = Number(episode?.script_line_count);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * The server's count of approved beats, for an episode sent without its
 * locked beats; null when the episode carries none. lib/productionSteps
 * approvedBeatCount is the one to call.
 */
export function approvedBeatCountFact(episode) {
  const n = Number(episode?.script_approved_beat_count);
  return episode?.script_approved_beat_count != null && Number.isInteger(n) && n >= 0 ? n : null;
}
