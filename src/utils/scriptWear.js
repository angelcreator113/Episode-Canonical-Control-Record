'use strict';

/**
 * What Lala has put on by a beat and line of the script, on the server
 * (Task #3188; Evoni, 2026-10-14, Lala's Phone phase 3 rulings 1 and 2).
 * The frontend twin is frontend/src/lib/scriptMoments.js (wearCues,
 * wornAt, closetBeat): the same cues, the same matching, the same beats.
 *
 * - Beats are numbered as the Script tab numbers them
 *   (EpisodeScriptTab.parseScriptIntoBeats): a `## BEAT: 8 · …` header names
 *   its beat, else its place; a script with no headers is cut into 14.
 *   A beat's lines are its non-empty lines after the header.
 * - `[WEAR: <wardrobe id>]` puts the look's piece on at its line; an older
 *   `[UI:SELECT Item <name>]` does when exactly one look piece has that name
 *   (case and spaces ignored). Any other cue counts for nothing.
 * - A look piece with no cue anywhere is put on at the end of the last
 *   getting-ready beat: the closet beat (the beat that opens the closet,
 *   else canonical beat 8), or the last beat with a wear cue if later. With
 *   neither, from the start. It is flagged "in the look, never equipped on
 *   screen".
 */

const { beatNumberForLabel } = require('./beatLabelNumber');

const BEAT_COUNT = 14;
const CLOSET_CANON = 8;
const WEAR_LINE = /^\s*\[WEAR:\s*([^\]\s]+)\s*\]\s*$/i;
const UI_LINE = /^\s*\[UI:\s*([A-Za-z_]+)\s*(.*?)\s*\]\s*$/;

const nameKey = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The script's beats as the Script tab numbers them: [{ number, lines }]. */
function scriptBeats(scriptText) {
  const text = String(scriptText || '');
  if (!text.trim()) return [];
  if (/##\s*BEAT:/i.test(text)) {
    // A header starts its line; a beat's number is the header's number or the
    // canonical beat its name names (utils/beatLabelNumber.js), else its place.
    return text.split(/(?=^[ \t]*##\s*BEAT:)/im)
      .filter((s) => /^\s*##\s*BEAT:/i.test(s))
      .map((section, i) => {
        const lines = section.split('\n').filter((l) => l.trim());
        const label = ((lines[0] || '').match(/##\s*BEAT:\s*(.+)/i)?.[1] || '').trim();
        return { number: beatNumberForLabel(label) || i + 1, lines: lines.slice(1) };
      });
  }
  const lines = text.split('\n').filter((l) => l.trim());
  const per = Math.max(1, Math.ceil(lines.length / BEAT_COUNT));
  const beats = [];
  for (let n = 1; n <= BEAT_COUNT; n += 1) {
    const bl = lines.slice((n - 1) * per, n * per);
    if (bl.length) beats.push({ number: n, lines: bl });
  }
  return beats;
}

/** Every wear cue in order, with the look piece it names (or null). */
function wearCues(beats, look) {
  const pieces = (look || []).filter(Boolean);
  const byId = new Map(pieces.map((p) => [String(p.id), p]));
  const cues = [];
  beats.forEach((beat, beatIndex) => {
    beat.lines.forEach((line, lineIndex) => {
      const wear = String(line).match(WEAR_LINE);
      if (wear) {
        cues.push({ beatIndex, lineIndex, piece: byId.get(String(wear[1])) || null });
        return;
      }
      const ui = String(line).match(UI_LINE);
      if (!ui || ui[1].toUpperCase() !== 'SELECT') return;
      const name = ui[2].replace(/^item\s+/i, '').trim();
      if (!name) return;
      const matches = pieces.filter((p) => nameKey(p.name) === nameKey(name));
      cues.push({ beatIndex, lineIndex, piece: matches.length === 1 ? matches[0] : null });
    });
  });
  return cues;
}

/** The index of the closet beat (the beat that opens the closet, else canonical beat 8), or -1. */
function closetIndex(beats) {
  const opens = beats.findIndex((b) => b.lines.some((l) => {
    const m = String(l).match(UI_LINE);
    return m && m[1].toUpperCase() === 'OPEN' && normKey(m[2]).startsWith('closet');
  }));
  return opens >= 0 ? opens : beats.findIndex((b) => b.number === CLOSET_CANON);
}

/** The index of the last getting-ready beat, or -1 when the script has none. */
function lastGettingReadyIndex(beats, cues) {
  const closet = closetIndex(beats);
  const lastCue = cues.filter((c) => c.piece).reduce((max, c) => Math.max(max, c.beatIndex), -1);
  return Math.max(closet, lastCue);
}

/**
 * The look's pieces worn by a beat (its number) and line (index in the
 * beat; none means the whole beat), and the uncued pieces:
 * { worn: [piece], uncued: [piece], beatFound }.
 */
function wornByBeat(scriptText, look, beatNumber, lineIndex = Infinity) {
  const beats = scriptBeats(scriptText);
  const cues = wearCues(beats, look);
  const at = beats.findIndex((b) => b.number === Number(beatNumber));
  const cued = new Set(cues.filter((c) => c.piece).map((c) => String(c.piece.id)));
  const uncued = (look || []).filter((p) => p && !cued.has(String(p.id)));
  if (at < 0) return { worn: [], uncued, beatFound: false };
  const seen = new Map();
  for (const c of cues) {
    if (c.beatIndex > at || (c.beatIndex === at && c.lineIndex > lineIndex)) break;
    if (c.piece && !seen.has(String(c.piece.id))) seen.set(String(c.piece.id), c.piece);
  }
  // Uncued pieces come on at the end of the last getting-ready beat: after
  // its cued pieces, so a line inside it crosses off only what was cued.
  const ready = lastGettingReadyIndex(beats, cues);
  const atEnd = ready < 0 || at > ready || (at === ready && lineIndex >= beats[ready].lines.length - 1);
  if (atEnd) for (const p of uncued) seen.set(String(p.id), p);
  return { worn: [...seen.values()], uncued, beatFound: true };
}

module.exports = { scriptBeats, wearCues, closetIndex, lastGettingReadyIndex, wornByBeat };
