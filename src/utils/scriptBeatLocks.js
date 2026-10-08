'use strict';

/**
 * Locked script beats (Evoni, 2026-10-08: "yes start with lock then drag
 * and drop"). Approving a beat on the Script tab locks it: the lock is kept
 * on the episode (episodes.script_locked_beats, a list of beat numbers),
 * and a writer that replaces the whole script puts each locked beat back
 * word for word. Regenerate therefore rewrites only the unlocked beats.
 *
 * A beat is the text from one `## BEAT:` header to the next, header
 * included. Its number is the header's number when it names a canonical
 * beat (1-14), otherwise its position, the same rule the Script tab's
 * parseScriptIntoBeats uses, so a lock means the same beat on both sides.
 *
 * Pure; no I/O.
 */

const BEAT_COUNT = 14;
const HEADER_LINE_RE = /^\s*##\s*BEAT:\s*(.*)$/i;

/** Splits script text into { preamble, beats: [{ number, text }] }. */
function splitScriptBeats(script) {
  const lines = String(script || '').split('\n');
  const preamble = [];
  const beats = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(HEADER_LINE_RE);
    if (m) {
      const numbered = Number((m[1].trim().match(/^(\d{1,2})\b/) || [])[1]);
      const number = numbered >= 1 && numbered <= BEAT_COUNT ? numbered : beats.length + 1;
      current = { number, lines: [line] };
      beats.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  return {
    preamble: preamble.join('\n'),
    beats: beats.map((b) => ({ number: b.number, text: b.lines.join('\n').replace(/\s+$/, '') })),
  };
}

/** The episode's locked beat numbers, cleaned: whole numbers 1-14, once each, in order. */
function normalizeLockedBeats(value) {
  if (!Array.isArray(value)) return [];
  const out = new Set();
  for (const v of value) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= BEAT_COUNT) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * The next script with every locked beat of the previous one put back as
 * it was. A locked beat the next script also has is replaced where it
 * stands; one the next script dropped goes back after the beat it followed
 * before (or first, when none of those is there). A locked number the
 * previous script has no beat for is ignored. Returns
 *   { script, kept: [numbers put back], changed: [numbers whose text differed or was missing] }.
 */
function keepLockedBeats(nextScript, prevScript, lockedBeats) {
  const locked = normalizeLockedBeats(lockedBeats);
  const next = String(nextScript ?? '');
  if (locked.length === 0 || !String(prevScript || '').trim()) return { script: next, kept: [], changed: [] };

  const prev = splitScriptBeats(prevScript);
  const prevByNumber = new Map();
  prev.beats.forEach((b) => { if (!prevByNumber.has(b.number)) prevByNumber.set(b.number, b); });
  const toKeep = locked.filter((n) => prevByNumber.has(n));
  if (toKeep.length === 0) return { script: next, kept: [], changed: [] };

  const split = splitScriptBeats(next);
  const beats = split.beats.slice();
  const changed = [];
  for (const n of toKeep) {
    const old = prevByNumber.get(n);
    const at = beats.findIndex((b) => b.number === n);
    if (at >= 0) {
      if (beats[at].text !== old.text) changed.push(n);
      beats[at] = old;
      continue;
    }
    changed.push(n);
    const prevOrder = prev.beats.map((b) => b.number);
    const before = prevOrder.slice(0, prevOrder.indexOf(n)).reverse();
    const anchor = before.map((m) => beats.findIndex((b) => b.number === m)).find((i) => i >= 0);
    beats.splice(anchor === undefined ? 0 : anchor + 1, 0, old);
  }
  if (changed.length === 0) return { script: next, kept: toKeep, changed };

  const body = beats.map((b) => b.text).join('\n\n');
  const preamble = split.preamble.replace(/\s+$/, '');
  return { script: preamble ? `${preamble}\n\n${body}` : body, kept: toKeep, changed };
}

module.exports = { splitScriptBeats, normalizeLockedBeats, keepLockedBeats, BEAT_COUNT };

/**
 * For a writer about to replace an episode's whole script: the script to
 * save, with the episode's locked beats kept from its current script.
 * `episode` is the row (or plain object) with script_content and
 * script_locked_beats; a missing episode changes nothing.
 */
function scriptKeepingLocks(episode, nextScript) {
  if (!episode) return { script: nextScript, kept: [], changed: [] };
  return keepLockedBeats(nextScript, episode.script_content, episode.script_locked_beats);
}

module.exports.scriptKeepingLocks = scriptKeepingLocks;
