'use strict';

/**
 * Canonical beats in script text (Evoni, 2026-10-03, episode creation
 * step 7; docs/EVENT_EPISODE_FLOW.md §8(j)): "every generated script beat
 * keeps its canonical beat number and key", and "the script generator does
 * not invent its own beats".
 *
 * One header line opens each beat: `## BEAT: <number> · <name>`, the
 * number and name from canonicalBeats.js. It is a rendering of the 14
 * canonical beats, not a new beat vocabulary, and it keeps the `## BEAT:`
 * prefix the existing readers already split on (scriptBeatParser,
 * EpisodeScriptTab), so they read it unchanged. Evaluation reads only the
 * [EVENT:] and [EPISODE_INTENT:] tags (docs/SCRIPT_PIPELINE.md §4), which
 * this does not touch.
 *
 * Pure; no I/O.
 */

const { CANONICAL_BEATS } = require('../constants/canonicalBeats');

const HEADER_RE = /^##\s*BEAT:\s*(\d{1,2})\b\s*[·.:\-–—]?\s*(.*)$/i;

function beatHeader(beat) {
  return `## BEAT: ${beat.number} · ${beat.name}`;
}

/**
 * Splits script text on canonical beat headers. Returns
 *   { beats: [{ number, name, header, text }], complete, missing, unknown, outOfOrder }
 * where beats are in script order, name is the canonical name for the
 * number (not whatever the header said), missing lists canonical numbers
 * with no header, unknown lists header numbers outside 1-14, and
 * outOfOrder is true when the numbers do not rise. Text before the first
 * header is not a beat and is ignored here.
 */
function splitCanonicalBeats(text) {
  const byNumber = new Map(CANONICAL_BEATS.map((b) => [b.number, b]));
  const beats = [];
  const unknown = [];
  let current = null;
  for (const line of String(text || '').split('\n')) {
    const m = line.trim().match(HEADER_RE);
    if (m) {
      const number = Number(m[1]);
      if (!byNumber.has(number)) { unknown.push(number); current = null; continue; }
      current = { number, name: byNumber.get(number).name, header: line.trim(), lines: [] };
      beats.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  const seen = new Set(beats.map((b) => b.number));
  const missing = CANONICAL_BEATS.map((b) => b.number).filter((n) => !seen.has(n));
  const outOfOrder = beats.some((b, i) => i > 0 && b.number <= beats[i - 1].number);
  return {
    beats: beats.map(({ lines, ...b }) => ({ ...b, text: lines.join('\n').trim() })),
    complete: missing.length === 0 && unknown.length === 0 && !outOfOrder,
    missing,
    unknown,
    outOfOrder,
  };
}

module.exports = { beatHeader, splitCanonicalBeats, HEADER_RE };
