/**
 * Approved (locked) beats on the page (History and Raw editor audits,
 * 2026-10-24). The server puts each locked beat back word for word when a
 * script is saved (src/utils/scriptBeatLocks.js keepLockedBeats). The page
 * did not, so a restored version, or a locked beat edited in the Raw
 * editor, showed other words under the "approved" badge until Save quietly
 * put the approved ones back. This is the page's copy of that rule, by beat
 * number as both sides number beats (a header's number or the canonical
 * beat its name names, else its place), so the page shows what Save will
 * keep. The server's answer is still the one kept: Save shows what it stored.
 *
 * One difference, ahead of the server's own fix: a beat whose header was
 * renamed or renumbered but whose lines are word for word an approved copy's
 * is taken as that copy (put back in place), not kept beside it as a second one.
 *
 * Pure: no React, no network.
 */
import { headerNumber, normalizeBeatHeaders } from './beatLabelNumber';

const HEADER_LINE = /^\s*##\s*BEAT:\s*(.*)$/i;

/** The script as { preamble, beats: [{ number, text }] }, as the server splits it. */
export function splitScriptBeats(script) {
  const lines = normalizeBeatHeaders(script || '').split('\n');
  const preamble = [];
  const beats = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(HEADER_LINE);
    if (m) {
      current = { number: headerNumber(m[1]) || beats.length + 1, lines: [line] };
      beats.push(current);
    } else if (current) current.lines.push(line);
    else preamble.push(line);
  }
  return {
    preamble: preamble.join('\n'),
    beats: beats.map((b) => ({ number: b.number, text: b.lines.join('\n').replace(/\s+$/, '') })),
  };
}

const lockList = (value) => [...new Set((Array.isArray(value) ? value : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1))].sort((a, b) => a - b);
const headerOf = (text) => String(text).split('\n')[0];
// A beat's words without its header and blank lines, to tell an edit from a re-spacing.
const bodyOf = (text) => String(text).split('\n').slice(1).map((l) => l.trim()).filter(Boolean).join('\n');
const names = (text, n) => headerNumber((headerOf(text).match(HEADER_LINE) || [])[1]) === n;

function withNumberedHeader(text, number) {
  const [header, ...rest] = String(text).split('\n');
  const m = header.match(HEADER_LINE);
  if (!m || headerNumber(m[1])) return text;
  const label = m[1].trim();
  return [`## BEAT: ${number}${label ? ` · ${label}` : ''}`, ...rest].join('\n');
}

/**
 * `nextScript` with every beat locked in `prevScript` put back as it was
 * there. Returns { script, kept: [numbers held], changed: [numbers whose
 * words were put back] }; `script` is `nextScript` itself when nothing changed.
 */
export function keepLockedBeats(nextScript, prevScript, lockedBeats) {
  const next = String(nextScript ?? '');
  const locked = lockList(lockedBeats);
  if (!locked.length || !String(prevScript || '').trim()) return { script: next, kept: [], changed: [] };
  const prev = splitScriptBeats(prevScript);
  const copies = new Map();
  prev.beats.forEach((b) => { if (!copies.has(b.number)) copies.set(b.number, []); copies.get(b.number).push(b); });
  const toKeep = locked.filter((n) => copies.has(n));
  if (!toKeep.length) return { script: next, kept: [], changed: [] };

  const split = splitScriptBeats(next);
  const beats = split.beats.slice();
  const prevOrder = prev.beats.map((b) => b.number);
  const extra = new Set();
  const changed = [];
  for (const n of toKeep) {
    const olds = copies.get(n);
    const oldTexts = olds.flatMap((o) => [o.text, withNumberedHeader(o.text, n)]);
    const at = beats.map((b, i) => (b.number === n && (names(b.text, n) || oldTexts.includes(b.text)) ? i : -1)).filter((i) => i >= 0);
    // A renamed or renumbered header over an approved copy's own lines.
    if (at.length < olds.length) {
      const bodies = olds.map((o) => bodyOf(o.text)).filter(Boolean);
      beats.forEach((b, i) => {
        if (at.length >= olds.length || at.includes(i) || !bodies.includes(bodyOf(b.text))) return;
        if (toKeep.some((m) => m !== n && names(b.text, m))) return;
        at.push(i);
      });
      at.sort((a, b) => a - b);
    }
    let differs = false;
    let placed = null;
    olds.forEach((old, k) => {
      const kept = { number: n, text: withNumberedHeader(old.text, n) };
      if (k < at.length) {
        const now = beats[at[k]].text;
        if (now !== old.text && now !== kept.text) { beats[at[k]] = kept; differs = true; }
        placed = beats[at[k]];
        return;
      }
      differs = true;
      let anchor;
      if (placed) anchor = beats.indexOf(placed);
      else {
        const before = prevOrder.slice(0, prevOrder.indexOf(n)).reverse();
        anchor = before.map((m) => beats.findIndex((b) => b.number === m)).find((i) => i >= 0);
      }
      beats.splice(anchor === undefined ? 0 : anchor + 1, 0, kept);
      placed = kept;
    });
    for (const i of at.slice(olds.length)) { extra.add(beats[i]); differs = true; }
    if (differs) changed.push(n);
  }
  if (!changed.length) return { script: next, kept: toKeep, changed };
  const body = beats.filter((b) => !extra.has(b)).map((b) => b.text).join('\n\n');
  const preamble = split.preamble.replace(/\s+$/, '');
  return { script: preamble ? `${preamble}\n\n${body}` : body, kept: toKeep, changed };
}

/**
 * The approved beats whose words on the page are not the saved ones (an
 * edit in the Raw editor that Save will put back), as `beat-<n>` ids the way
 * the tab ids its beats (`beat-<n>-2` for a second copy).
 */
export function editedLockedBeats(pageScript, savedScript, lockedBeats) {
  const out = new Set();
  const locked = new Set(lockList(lockedBeats));
  if (!locked.size || !String(savedScript || '').trim()) return out;
  const saved = new Map();
  splitScriptBeats(savedScript).beats.forEach((b) => { if (!saved.has(b.number)) saved.set(b.number, []); saved.get(b.number).push(b); });
  const seen = new Map();
  for (const b of splitScriptBeats(pageScript).beats) {
    const k = (seen.get(b.number) || 0) + 1; seen.set(b.number, k);
    if (!locked.has(b.number) || !saved.has(b.number)) continue;
    const was = saved.get(b.number)[k - 1];
    if (!was || bodyOf(was.text) !== bodyOf(b.text)) out.add(k === 1 ? `beat-${b.number}` : `beat-${b.number}-${k}`);
  }
  return out;
}
