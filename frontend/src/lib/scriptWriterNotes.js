/**
 * Notes to the writer left in a script (Evoni, 2026-10-25): lines that are
 * not meant to be read on camera. "Ready to film?" lists each one with its
 * beat and line, and Import a script lists the ones it could not convert.
 *
 *   [IF she wins] …          a condition for the writer
 *   [NOTE: …], Note: …       a note
 *   (only include this line if …)
 *   TODO, TBD, FIXME
 *   ??? standing on its own  (not "What???", which is her line)
 *   [ALT: …]                 another version of the line
 *   {name}, {coins}          a placeholder still to fill
 *   XX                       a number or name still to fill ("XX coins")
 *
 * Pure: no React, no network.
 */

// Each rule: a key, what it is in plain words, and the test.
export const WRITER_NOTE_RULES = [
  { key: 'if', what: 'a condition for the writer ([IF …])', test: /\[\s*IF\b[^\]]*\]/i },
  { key: 'note', what: 'a note ([NOTE: …])', test: /\[\s*NOTES?\s*:[^\]]*\]|^\s*(?:\*\*|__)?\s*NOTES?\s*(?:\*\*|__)?\s*:/i },
  { key: 'only-if', what: 'a "use this line only if" note', test: /\(\s*(?:only|include|use|keep|cut|drop|delete|remove|add)\b[^)]*\bif\b[^)]*\)/i },
  { key: 'todo', what: 'a TODO, TBD or FIXME', test: /\b(?:TODO|TBD|FIXME)\b/i },
  { key: 'unknown', what: 'a "???" still to fill', test: /(?:^|[\s[({:"“])\?{3,}/ },
  { key: 'alt', what: 'another version of the line ([ALT: …])', test: /\[\s*ALT(?:ERNATE|ERNATIVE)?\s*:[^\]]*\]/i },
  { key: 'placeholder', what: 'a {placeholder} still to fill', test: /\{[^{}\n]*\}/ },
  { key: 'xx', what: 'an "XX" still to fill', test: /(?:^|[^A-Za-z0-9_])XX+(?![A-Za-z0-9_])/ },
];

/** The first writer-note rule a line breaks: { key, what }, or null. */
export function writerNoteOf(line) {
  const t = String(line ?? '').trim();
  if (!t) return null;
  for (const r of WRITER_NOTE_RULES) {
    if (r.test.test(t)) return { key: r.key, what: r.what };
  }
  return null;
}

// The Script tab numbers a beat's cards without its hidden [STAT:] and
// [MAIL:] lines (EpisodeScriptTab parseLine), so "line 4" is the fourth card.
const HIDDEN = /^\s*\[(?:STAT|MAIL)\s*:/i;
const RULE = /^(?:-[ \t]*){3,}$|^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$/;
export function cardNumber(lines = [], index = 0) {
  let n = 0;
  for (let i = 0; i <= index && i < lines.length; i += 1) {
    const t = String(lines[i] ?? '').trim();
    if (!t || HIDDEN.test(t) || RULE.test(t)) continue;
    n += 1;
  }
  return n;
}

const short = (s, max = 70) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/**
 * Every writer note in the beats ({ id, number, lines }), in order:
 * [{ beatIndex, beatId, beatNumber, lineIndex, line (the card number), key, what, text }].
 */
export function writerNotes(beats = []) {
  const out = [];
  (beats || []).forEach((b, beatIndex) => {
    const lines = Array.isArray(b?.lines) ? b.lines : [];
    lines.forEach((l, lineIndex) => {
      const found = writerNoteOf(l);
      if (!found) return;
      out.push({ beatIndex, beatId: b.id || null, beatNumber: b.number ?? beatIndex + 1, lineIndex, line: cardNumber(lines, lineIndex), ...found, text: String(l).trim() });
    });
  });
  return out;
}

// More than this many notes: the rest are counted in one row.
export const MAX_NOTE_ROWS = 12;

/** "Ready to film?" rows for the writer notes: one per note (up to MAX_NOTE_ROWS), or one clear row. */
export function writerNoteRows(beats = []) {
  const notes = writerNotes(beats);
  if (!notes.length) return [{ key: 'writer-notes', ok: true, beatId: null, text: 'No notes to the writer left in the script.' }];
  const rows = notes.slice(0, MAX_NOTE_ROWS).map((n) => ({
    key: `writer-note-${n.beatId || n.beatIndex}-${n.lineIndex}`, ok: false, beatId: n.beatId,
    text: `Beat ${n.beatNumber}, line ${n.line}: ${n.what}, not for the camera. Take it out or rewrite it: “${short(n.text)}”`,
  }));
  if (notes.length > MAX_NOTE_ROWS) {
    const more = notes.length - MAX_NOTE_ROWS;
    rows.push({ key: 'writer-notes-more', ok: false, beatId: null, text: `${more} more note${more === 1 ? '' : 's'} to the writer in the script.` });
  }
  return rows;
}
