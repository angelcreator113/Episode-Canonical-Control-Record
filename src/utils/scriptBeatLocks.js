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
 * beat (1-14), or the beat a name names (utils/beatLabelNumber.js),
 * otherwise its position: the same rule the Script tab's
 * parseScriptIntoBeats uses, so a lock means the same beat on both sides.
 *
 * Pure; no I/O.
 */

const { beatNumberForLabel, normalizeBeatHeaders } = require('./beatLabelNumber');

const BEAT_COUNT = 14;
const HEADER_LINE_RE = /^\s*##\s*BEAT:\s*(.*)$/i;

/** Splits script text into { preamble, beats: [{ number, text }] }. */
function splitScriptBeats(script) {
  const lines = normalizeBeatHeaders(script || '').split('\n');
  const preamble = [];
  const beats = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(HEADER_LINE_RE);
    if (m) {
      // A header's number, or the canonical beat its name names, else its place.
      const number = beatNumberForLabel(m[1]) || beats.length + 1;
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
 * A locked beat's text with its number written into a header that names
 * none (`## BEAT: Bonus scene` at place 2 becomes `## BEAT: 2 · Bonus
 * scene`). Such a beat is numbered by its place, so put back after a move
 * it took another beat's number and its lock (Script tab re-audit,
 * 2026-10-15); written in, the number goes where the beat goes.
 */
function withNumberedHeader(text, number) {
  const [header, ...rest] = String(text).split('\n');
  const m = header.match(HEADER_LINE_RE);
  if (!m || beatNumberForLabel(m[1])) return text;
  const label = m[1].trim();
  return [`## BEAT: ${number}${label ? ` · ${label}` : ''}`, ...rest].join('\n');
}

/**
 * The next script with every locked beat of the previous one put back as
 * it was. A locked beat the next script also has is replaced where it
 * stands; one the next script dropped goes back after the beat it followed
 * before (or first, when none of those is there). A number held by more
 * than one beat keeps every one of them, the first copy in place of the
 * first, the second of the second (Script tab re-audit, 2026-10-15: the tab
 * shows each copy approved, and only the first was kept). A locked number
 * the previous script has no beat for is ignored. Returns
 *   { script, kept: [numbers put back], changed: [numbers whose text differed or was missing] }.
 */
function keepLockedBeats(nextScript, prevScript, lockedBeats) {
  const locked = normalizeLockedBeats(lockedBeats);
  const next = String(nextScript ?? '');
  if (locked.length === 0 || !String(prevScript || '').trim()) return { script: next, kept: [], changed: [] };

  const prev = splitScriptBeats(prevScript);
  const prevCopies = new Map();
  prev.beats.forEach((b) => { if (!prevCopies.has(b.number)) prevCopies.set(b.number, []); prevCopies.get(b.number).push(b); });
  const toKeep = locked.filter((n) => prevCopies.has(n));
  if (toKeep.length === 0) return { script: next, kept: [], changed: [] };

  const split = splitScriptBeats(next);
  const beats = split.beats.slice();
  const changed = [];
  const prevOrder = prev.beats.map((b) => b.number);
  for (const n of toKeep) {
    let differs = false;
    let placed = null;
    const at = beats.map((b, i) => (b.number === n ? i : -1)).filter((i) => i >= 0);
    prevCopies.get(n).forEach((old, k) => {
      const kept = { number: n, text: withNumberedHeader(old.text, n) };
      if (k < at.length) {
        const now = beats[at[k]].text;
        if (now !== old.text && now !== kept.text) { beats[at[k]] = kept; differs = true; }
        placed = beats[at[k]];
        return;
      }
      differs = true;
      let anchor;
      if (placed) {
        anchor = beats.indexOf(placed);
      } else {
        const before = prevOrder.slice(0, prevOrder.indexOf(n)).reverse();
        anchor = before.map((m) => beats.findIndex((b) => b.number === m)).find((i) => i >= 0);
      }
      beats.splice(anchor === undefined ? 0 : anchor + 1, 0, kept);
      placed = kept;
    });
    if (differs) changed.push(n);
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
