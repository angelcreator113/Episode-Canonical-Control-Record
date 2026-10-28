/**
 * How long a script plays, roughly (Script tab audit, 2026-10-15): spoken
 * words at 150 a minute, a few seconds for each action and each moment on
 * screen, nothing for the tags the viewer never sees. An estimate to pace a
 * beat by, not a timeline; the edit decides the real length.
 */

import { speakerLine, isRuleLine, isHerSpeaker, HER } from './scriptSpeaker';

// The standard reading speed. A learned pace (lib/learnedPace; Evoni,
// 2026-10-28: "learn my real reading pace") replaces it for her lines when
// passed as `pace`; with none, every estimate is the standard one.
export const WORDS_PER_MINUTE = 150;
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

/**
 * The words a minute a spoken line is timed at. `pace`: null (the standard
 * 150), or { wpm, reader } where `wpm` times the lines of `reader` (her,
 * JustAWoman, by default; null for every speaker).
 */
export function lineWpm(speaker, pace = null) {
  const wpm = Number(pace?.wpm);
  if (!(wpm > 0)) return WORDS_PER_MINUTE;
  const reader = pace.reader === undefined ? HER : pace.reader;
  if (reader == null) return wpm;
  const same = isHerSpeaker(reader) ? isHerSpeaker(speaker) : String(speaker || '').trim().toLowerCase() === String(reader).trim().toLowerCase();
  return same ? wpm : WORDS_PER_MINUTE;
}

/** The spoken words in a line's words (an aside in brackets is acted, not spoken). */
export const countSpokenWords = spokenWords;

/** Seconds one line takes on screen. `pace`: see lineWpm (null: the standard estimate). */
export function lineSeconds(line, pace = null) {
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
  if (m && m.words) return (spokenWords(m.words) / lineWpm(m.speaker, pace)) * 60;
  // Plain narration reads as a stage direction.
  return ACTION_SECONDS;
}

/** Seconds a beat takes, from its lines (whole seconds). `pace`: see lineWpm. */
export function beatSeconds(lines = [], pace = null) {
  return Math.round((Array.isArray(lines) ? lines : []).reduce((sum, l) => sum + lineSeconds(l, pace), 0));
}

/** Seconds the whole script takes: each beat's, added. `pace`: see lineWpm. */
export function scriptSeconds(beats = [], pace = null) {
  return (Array.isArray(beats) ? beats : []).reduce((sum, b) => sum + beatSeconds(b?.lines, pace), 0);
}

/** "~45s", "~2m 10s", "~3m". */
export function formatRuntime(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `~${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `~${m}m ${rest}s` : `~${m}m`;
}
