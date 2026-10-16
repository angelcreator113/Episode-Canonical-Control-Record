// Who says a script line (Script tab re-audit, 2026-10-15). The Script tab,
// Rewrite line, the runtime and the export each had their own rule: the tab
// read `Lala (V.O.):`, `Mary Jane:` and `JustAWoman:` as speakers, the others
// did not, so a rewrite dropped the speaker and the export printed the line
// as action; `Note:` was a speaker everywhere but the tab. One rule for all.

// A label before a colon that names a thing, not a person.
export const NOT_SPEAKERS = new Set(['location', 'scene', 'setting', 'time', 'note', 'notes', 'transition', 'cut', 'int', 'ext', 'beat', 'act', 'sfx', 'music', 'caption']);

const KNOWN = { me: 'Prime', prime: 'Prime', lala: 'Lala', kelli: 'Kelli', guest: 'Guest' };

// A name (one or two capitalised words, any letters), an optional note in
// parentheses, a colon, the words.
// `\p{Lu}`: a capital in any language (`Émile:`; re-audit 2).
const SPEAKER_LINE = /^(Me|Prime|Lala|Kelli|Guest|\p{Lu}[\p{L}'’.-]*(?: \p{Lu}[\p{L}'’.-]*)?)\s*(\([^)]*\))?\s*:\s*(.*)$/u;

/**
 * A speaker's line as { speaker, label, note, prefix, words }, or null when
 * the line has no speaker. `speaker` is the person (`Me:` and `LALA:` are
 * Prime and Lala); `label` is the name as written; `note` is `(V.O.)` or
 * null; `prefix` is everything before the words, as written.
 */
export function speakerLine(line) {
  const t = String(line ?? '').trim();
  const m = t.match(SPEAKER_LINE);
  if (!m || NOT_SPEAKERS.has(m[1].toLowerCase())) return null;
  return {
    speaker: KNOWN[m[1].toLowerCase()] || m[1],
    label: m[1],
    note: m[2] || null,
    prefix: t.slice(0, t.length - m[3].length),
    words: m[3].trim(),
  };
}

/** The words without the one pair of quotes around them; a quote inside stays. */
export function unquote(words) {
  const t = String(words ?? '').trim();
  const m = t.match(/^["“]([\s\S]*)["”]$/);
  return m ? m[1].trim() : t;
}
