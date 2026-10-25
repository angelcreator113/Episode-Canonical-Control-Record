'use strict';

/**
 * Who says a script line, on the server (character voices that learn,
 * Evoni, 2026-10-25). The same rule as the Script tab's
 * frontend/src/lib/scriptSpeaker.js (speakerLine, isHerSpeaker, scriptCast,
 * unquote, unbold): `Me:`, `Prime:`, `JustAWoman:` and `JAWIHP:` are her;
 * `Lala (V.O.):` is Lala; a label that names a thing (`Location:`) or
 * narration (`Suddenly: ...`) is no one. Kept in step with the frontend
 * file by hand: a change there is made here too
 * (tests/unit/utils/scriptSpeaker.test.js reads the same cases).
 *
 * Pure; no I/O.
 */

const NOT_SPEAKERS = new Set([
  'location', 'scene', 'setting', 'time', 'note', 'notes', 'transition', 'cut', 'int', 'ext', 'beat', 'act', 'sfx', 'music', 'caption',
  'logline', 'episode', 'title', 'goal', 'goals', 'summary', 'synopsis', 'theme', 'hook', 'forward hook', 'date', 'cast',
  'wardrobe', 'outfit', 'event', 'venue',
]);

const KNOWN = { me: 'Prime', prime: 'Prime', lala: 'Lala', kelli: 'Kelli', guest: 'Guest' };

// Her names as the script writes them; every one is JustAWoman.
const HERS = new Set(['prime', 'me', 'justawoman', 'jawihp']);
const HER = 'JustAWoman';
const isHerSpeaker = (speaker) => HERS.has(String(speaker || '').trim().toLowerCase());
const shownSpeaker = (speaker) => (isHerSpeaker(speaker) ? HER : speaker);

const NARRATION_WORDS = new Set(['suddenly', 'then', 'later', 'meanwhile', 'finally', 'now', 'again', 'elsewhere', 'outside', 'inside', 'afterwards', 'afterward', 'moments later', 'cut to', 'smash cut', 'flashback', 'montage', 'insert', 'title', 'super', 'pause', 'silence', 'fade in', 'fade out', 'on screen', 'onscreen', 'back to']);
const NARRATION = /^\p{Ll}\S*(?:\s+\S+){2,}/u;
const SPEAKER_LINE = /^(Me|Prime|Lala|Kelli|Guest|\p{Lu}[\p{L}'’.-]*(?: \p{Lu}[\p{L}'’.-]*)?)\s*(\([^)]*\))?\s*:\s*(.*)$/u;
const LOWER_LINE = /^(\p{L}[\p{L}'’.-]*(?: \p{L}[\p{L}'’.-]*)?)\s*(\([^)]*\))?\s*:\s*(.*)$/u;

const unbold = (line) => String(line ?? '').replace(/^\s*(\*\*|__)\s*([^*_:]+?)\s*(?:\1\s*:|:\s*\1)\s*/, '$2: ');

function castNameOf(cast, key) {
  if (!cast) return null;
  for (const n of cast) if (typeof n === 'string' && n.trim().toLowerCase() === key) return n.trim();
  return null;
}

/** A speaker's line as { speaker, label, note, prefix, words }, or null. */
function speakerLine(line, { cast = null } = {}) {
  const t = String(line ?? '').trim();
  const plain = unbold(t).trim();
  let m = plain.match(SPEAKER_LINE);
  let castName = null;
  if (!m) {
    const low = plain.match(LOWER_LINE);
    const key = low ? low[1].toLowerCase() : null;
    castName = key && !KNOWN[key] && !HERS.has(key) ? castNameOf(cast, key) : null;
    if (low && (KNOWN[key] || HERS.has(key) || castName)) m = low;
  }
  if (!m || NOT_SPEAKERS.has(m[1].toLowerCase()) || NARRATION_WORDS.has(m[1].toLowerCase())) return null;
  if (!KNOWN[m[1].toLowerCase()] && !HERS.has(m[1].toLowerCase()) && !castName && !m[2] && NARRATION.test(m[3].trim())) return null;
  return {
    speaker: KNOWN[m[1].toLowerCase()] || castName || m[1],
    label: m[1],
    note: m[2] || null,
    prefix: t.slice(0, t.length - m[3].length),
    words: m[3].trim(),
  };
}

/** The people a script names as speakers with a capital, for the same names in lower case. */
function scriptCast(lines = []) {
  const out = new Set();
  for (const l of lines) {
    const sp = speakerLine(l);
    if (sp && !KNOWN[sp.label.toLowerCase()] && !HERS.has(sp.label.toLowerCase())) out.add(sp.speaker);
  }
  return out;
}

/** The words without the one pair of quotes around them. */
function unquote(words) {
  const t = String(words ?? '').trim();
  const m = t.match(/^["“]([\s\S]*)["”]$/);
  return m ? m[1].trim() : t;
}

module.exports = { NOT_SPEAKERS, NARRATION_WORDS, HER, isHerSpeaker, shownSpeaker, speakerLine, scriptCast, unquote, unbold };
