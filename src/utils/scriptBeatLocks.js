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

const { headerNumber, normalizeBeatHeaders } = require('./beatLabelNumber');

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
      const number = headerNumber(m[1]) || beats.length + 1;
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
  if (!m || headerNumber(m[1])) return text;
  const label = m[1].trim();
  return [`## BEAT: ${number}${label ? ` · ${label}` : ''}`, ...rest].join('\n');
}

// The beat's lines after its header, without blank lines around them.
const bodyOf = (text) => String(text).split('\n').slice(1).join('\n').replace(/^(?:[^\S\n]*\n)+/, '').replace(/\s+$/, '');
const headerNamesNumber = (text, n) => headerNumber((String(text).split('\n')[0].match(HEADER_LINE_RE) || [])[1]) === n;

/** `lines` without `block` (lines, in order) at their end, blank lines aside; null when they don't end with it. */
function withoutTail(lines, block) {
  let end = lines.length;
  while (end > 0 && !lines[end - 1].trim()) end -= 1;
  const start = end - block.length;
  if (start < 0 || !block.every((l, k) => lines[start + k] === l)) return null;
  return lines.slice(0, start);
}

/** A header's label without the number it starts with (`2 · New scene` reads `New scene`). */
function labelWithoutNumber(header) {
  const m = String(header).match(HEADER_LINE_RE);
  const label = (m ? m[1] : '').trim().replace(/^beat\b[\s#:.-]*(?=\d)/i, '');
  return label.replace(/^\d{1,3}\b[^\S\n]*(?:[:.·|—–-][^\S\n]*)?/, '').trim();
}

/**
 * The next script with every locked beat of the previous one put back as
 * it was. Returns
 *   { script, kept: [numbers put back], changed: [numbers whose text differed or was missing],
 *     moved: [{ from, to, header }] }.
 *
 * Which beat of the next script is a locked beat's copy, in this order
 * (History/Raw editor audit, 2026-10-24):
 *   1. a beat word for word an approved copy, whatever its header says;
 *   2. a beat whose lines are the approved copy's word for word, its header
 *      aside (R3: a renamed or renumbered header was a second beat, and the
 *      approved beat came back beside it). Its header is put back. Only a
 *      beat numbered n by its place, by a number the previous script had no
 *      beat for, or by a number two beats now share: a beat still standing
 *      under its own number is that beat, whatever lines it shares;
 *   3. a beat whose header names the number (the first copy in place of
 *      the first approved copy, the second of the second: Script tab
 *      re-audit, 2026-10-15). A beat numbered n only by its place is not a
 *      copy: it is another beat that moved there (re-audit 2).
 * A copy the next script dropped goes back after the beat it followed
 * before (or first, when none of those is there). When the beat it goes
 * after (or, going first, the lines before the first header) ends with its
 * lines word for word (R1: its header line was deleted, so its lines joined
 * the beat above), they are taken out there first, so they are not in the
 * script twice.
 *
 * A beat whose header names a locked number, past the approved copies:
 *   - by default (a writer's reply) it is dropped (Script page audit,
 *     2026-10-19: a reply with two headers for an approved beat saved the
 *     second as an extra beat);
 *   - with { keepExtras: true } (the page's own edits: Save, a lock that
 *     saves) it is kept where it stands with the first free number past 14
 *     written in (`## BEAT: 2 · New scene` becomes `## BEAT: 15 · New
 *     scene`), never a canonical beat's number, so it is no beat's copy and
 *     takes no lock (R2: it was dropped with its new lines). `moved` names it.
 * A locked number the previous script has no beat for is ignored.
 */
function keepLockedBeats(nextScript, prevScript, lockedBeats, { keepExtras = false } = {}) {
  const locked = normalizeLockedBeats(lockedBeats);
  const next = String(nextScript ?? '');
  if (locked.length === 0 || !String(prevScript || '').trim()) return { script: next, kept: [], changed: [], moved: [] };

  const prev = splitScriptBeats(prevScript);
  const prevCopies = new Map();
  prev.beats.forEach((b) => { if (!prevCopies.has(b.number)) prevCopies.set(b.number, []); prevCopies.get(b.number).push(b); });
  const toKeep = locked.filter((n) => prevCopies.has(n));
  if (toKeep.length === 0) return { script: next, kept: [], changed: [], moved: [] };

  const split = splitScriptBeats(next);
  const beats = split.beats.slice();
  let preambleLines = split.preamble.split('\n');
  let preambleChanged = false;
  const prevOrder = prev.beats.map((b) => b.number);

  // Which beats are copies: claims[n] = indices into beats.
  const claims = new Map(toKeep.map((n) => [n, []]));
  const claimed = new Set();
  const claim = (n, test) => {
    const slots = prevCopies.get(n).length - claims.get(n).length;
    if (slots <= 0) return;
    const found = beats.map((b, i) => (!claimed.has(i) && test(b) ? i : -1)).filter((i) => i >= 0).slice(0, slots);
    found.forEach((i) => { claimed.add(i); claims.get(n).push(i); });
  };
  for (const n of toKeep) {
    const olds = prevCopies.get(n).flatMap((o) => [o.text, withNumberedHeader(o.text, n)]);
    claim(n, (b) => olds.includes(b.text));
  }
  // By its lines, header aside: a beat whose number is n by its place, a
  // number the previous script had no beat for, or one two beats now share
  // (the renumbered header landed on another beat). Never another beat that
  // is still there as it was numbered, which only shares the lines.
  const nextCount = new Map();
  beats.forEach((b) => nextCount.set(b.number, (nextCount.get(b.number) || 0) + 1));
  const renamedFrom = (b, n) => b.number === n || !prevCopies.has(b.number) || nextCount.get(b.number) > 1;
  for (const n of toKeep) {
    const bodies = prevCopies.get(n).map((o) => bodyOf(o.text)).filter((t) => t.trim());
    claim(n, (b) => renamedFrom(b, n) && bodies.includes(bodyOf(b.text)));
  }
  for (const n of toKeep) claim(n, (b) => b.number === n && headerNamesNumber(b.text, n));

  const changed = new Set();
  // Copies in place, in the order they stand.
  const placedOf = new Map();
  for (const n of toKeep) {
    const at = claims.get(n).sort((x, y) => x - y);
    placedOf.set(n, []);
    at.forEach((i, k) => {
      const old = prevCopies.get(n)[k];
      const kept = { number: n, text: withNumberedHeader(old.text, n) };
      if (beats[i].text !== old.text && beats[i].text !== kept.text) { beats[i] = kept; changed.add(n); } else { beats[i] = { number: n, text: beats[i].text }; }
      placedOf.get(n).push(beats[i]);
    });
  }
  const copies = new Set([...placedOf.values()].flat());

  // Beats whose header names a locked number, past the approved copies.
  const extra = new Set();
  beats.forEach((b, i) => {
    const n = b.number;
    if (claimed.has(i) || !claims.has(n) || !headerNamesNumber(b.text, n)) return;
    extra.add(b);
    if (!keepExtras) changed.add(n);
  });

  // Copies the next script dropped go back.
  for (const n of toKeep) {
    const placedList = placedOf.get(n);
    prevCopies.get(n).slice(placedList.length).forEach((old) => {
      changed.add(n);
      const kept = { number: n, text: withNumberedHeader(old.text, n) };
      let anchor;
      if (placedList.length) {
        anchor = beats.indexOf(placedList[placedList.length - 1]);
      } else {
        const before = prevOrder.slice(0, prevOrder.indexOf(n)).reverse();
        anchor = before.map((m) => beats.findIndex((b) => b.number === m && !extra.has(b))).find((i) => i >= 0);
      }
      // R1: its header line deleted, its lines joined the beat above it (or
      // the lines before the first header): when that beat ends with them
      // word for word, they come out there first. Only there, and only at
      // its end, so a line another beat shares is never taken.
      const block = bodyOf(old.text).split('\n');
      if (block.some((l) => l.trim())) {
        const host = anchor === undefined ? null : beats[anchor];
        if (host && !copies.has(host) && !extra.has(host)) {
          const [header, ...rest] = host.text.split('\n');
          const left = withoutTail(rest, block);
          if (left) beats[anchor] = { number: host.number, text: [header, ...left].join('\n').replace(/\s+$/, '') };
        } else if (anchor === undefined) {
          const left = withoutTail(preambleLines, block);
          if (left) { preambleLines = left; preambleChanged = true; }
        }
      }
      beats.splice(anchor === undefined ? 0 : anchor + 1, 0, kept);
      copies.add(kept);
      placedList.push(kept);
    });
  }

  // R2: with keepExtras, an extra beat keeps its lines under a number of its own.
  const moved = [];
  if (keepExtras && extra.size) {
    const used = new Set(beats.map((b) => b.number));
    let free = 15;
    for (const b of beats) {
      if (!extra.has(b)) continue;
      while (used.has(free)) free += 1;
      const label = labelWithoutNumber(b.text.split('\n')[0]);
      const header = `## BEAT: ${free}${label ? ` · ${label}` : ''}`;
      moved.push({ from: b.number, to: free, header });
      used.add(free);
      const i = beats.indexOf(b);
      beats[i] = { number: free, text: [header, ...b.text.split('\n').slice(1)].join('\n') };
    }
    extra.clear();
  }

  const changedList = toKeep.filter((n) => changed.has(n));
  if (changedList.length === 0 && moved.length === 0 && !preambleChanged) return { script: next, kept: toKeep, changed: [], moved: [] };

  const body = beats.filter((b) => !extra.has(b)).map((b) => b.text).join('\n\n');
  const preamble = preambleLines.join('\n').replace(/\s+$/, '');
  return { script: preamble ? `${preamble}\n\n${body}` : body, kept: toKeep, changed: changedList, moved };
}

module.exports = { splitScriptBeats, normalizeLockedBeats, keepLockedBeats, withNumberedHeader, BEAT_COUNT };

/**
 * For a writer about to replace an episode's whole script: the script to
 * save, with the episode's locked beats kept from its current script.
 * `episode` is the row (or plain object) with script_content and
 * script_locked_beats; a missing episode changes nothing. `options` go to
 * keepLockedBeats ({ keepExtras: true } for the page's own edits).
 */
function scriptKeepingLocks(episode, nextScript, options = {}) {
  if (!episode) return { script: nextScript, kept: [], changed: [], moved: [] };
  return keepLockedBeats(nextScript, episode.script_content, episode.script_locked_beats, options);
}

module.exports.scriptKeepingLocks = scriptKeepingLocks;

/**
 * The script with no more than `counts.get(n)` beats numbered n, for each n
 * in `counts`: later copies are dropped (Script page audit, 2026-10-19: a
 * writer's reply with two headers for an approved beat kept the second as an
 * extra beat). A copy is a beat whose header names n; one numbered n only
 * by its place is another beat, and stays. Other beats and the preamble
 * stay as they are.
 */
function withoutExtraCopies(script, counts) {
  const split = splitScriptBeats(script);
  const seen = new Map();
  const names = (b) => headerNumber((b.text.split('\n')[0].match(HEADER_LINE_RE) || [])[1]) === b.number;
  const beats = split.beats.filter((b) => {
    if (!counts.has(b.number) || !names(b)) return true;
    const k = (seen.get(b.number) || 0) + 1;
    seen.set(b.number, k);
    return k <= counts.get(b.number);
  });
  if (beats.length === split.beats.length) return String(script ?? '');
  const body = beats.map((b) => b.text).join('\n\n');
  const preamble = split.preamble.replace(/\s+$/, '');
  return preamble ? `${preamble}\n\n${body}` : body;
}

module.exports.withoutExtraCopies = withoutExtraCopies;
