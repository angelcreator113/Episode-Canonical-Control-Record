/**
 * How long a script plays, roughly (Script tab audit, 2026-10-15): spoken
 * words at 150 a minute, a few seconds for each action and each moment on
 * screen, nothing for the tags the viewer never sees. An estimate to pace a
 * beat by, not a timeline; the edit decides the real length.
 */

import { speakerLine, isRuleLine } from './scriptSpeaker';

const WORDS_PER_MINUTE = 150;
const ACTION_SECONDS = 3;
// A [UI:] moment on screen: three seconds, as the teleprompter gives her to
// react (lib/teleprompterScreen SCREEN_SECONDS is this one; Script tab audit
// 6, 2026-10-24: the runtime said 2).
export const MOMENT_SECONDS = 3;
const TRANSITION_SECONDS = 1;

// Tags that are read by the show, not seen (stats, mail, wardrobe and deal
// cues, scene hints). [TRANSITION:] takes a beat of screen time.
const HIDDEN_TAG = /^\[(STAT|MAIL|WEAR|DELIVER|TODO_MODE|LEARNS|SCENE|LOCATION_HINT)\s*:/i;
const TRANSITION_TAG = /^\[TRANSITION\s*:/i;
const UI_TAG = /^\[UI\s*:/i;
const ANY_TAG = /^\[[A-Z_]+\s*:.*\]$/i;
// The same speaker labels the Script tab's line parser reads.
// Who speaks: the Script tab's rule (lib/scriptSpeaker.js).

const spokenWords = (text) => String(text || '')
  .replace(/\([^)]*\)/g, ' ') // an aside in the line is acted, not spoken
  .replace(/["“”]/g, ' ')
  .split(/\s+/)
  .filter((w) => /[A-Za-z0-9]/.test(w)).length;

/** Seconds one line takes on screen. */
export function lineSeconds(line) {
  const t = (typeof line === 'string' ? line : '').trim();
  // A `---` rule takes no screen time (lib/scriptSpeaker isRuleLine).
  if (!t || isRuleLine(t)) return 0;
  if (TRANSITION_TAG.test(t)) return TRANSITION_SECONDS;
  if (HIDDEN_TAG.test(t)) return 0;
  if (UI_TAG.test(t)) return MOMENT_SECONDS;
  // Any other bracket tag ([EVENT:], [LOCATION:]…) is a note, not screen time.
  if (ANY_TAG.test(t)) return 0;
  if (/^\(.*\)$/.test(t)) return ACTION_SECONDS;
  const m = speakerLine(t);
  if (m && m.words) return (spokenWords(m.words) / WORDS_PER_MINUTE) * 60;
  // Plain narration reads as a stage direction.
  return ACTION_SECONDS;
}

/** Seconds a beat takes, from its lines (whole seconds). */
export function beatSeconds(lines = []) {
  return Math.round((Array.isArray(lines) ? lines : []).reduce((sum, l) => sum + lineSeconds(l), 0));
}

/** Seconds the whole script takes: each beat's, added. */
export function scriptSeconds(beats = []) {
  return (Array.isArray(beats) ? beats : []).reduce((sum, b) => sum + beatSeconds(b?.lines), 0);
}

/** "~45s", "~2m 10s", "~3m". */
export function formatRuntime(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `~${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `~${m}m ${rest}s` : `~${m}m`;
}
