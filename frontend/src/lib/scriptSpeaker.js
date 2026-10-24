// Who says a script line (Script tab re-audit, 2026-10-15). The Script tab,
// Rewrite line, the runtime and the export each had their own rule: the tab
// read `Lala (V.O.):`, `Mary Jane:` and `JustAWoman:` as speakers, the others
// did not, so a rewrite dropped the speaker and the export printed the line
// as action; `Note:` was a speaker everywhere but the tab. One rule for all.

// A label before a colon that names a thing, not a person.
export const NOT_SPEAKERS = new Set(['location', 'scene', 'setting', 'time', 'note', 'notes', 'transition', 'cut', 'int', 'ext', 'beat', 'act', 'sfx', 'music', 'caption']);

const KNOWN = { me: 'Prime', prime: 'Prime', lala: 'Lala', kelli: 'Kelli', guest: 'Guest' };

// Her names as the script writes them (lib/scriptRuleChecks JAW_SAYS; `Me:`
// reads as Prime on the Script tab). Evoni, 2026-10-24: every one of them is
// JustAWoman in the Table read, Print and the export, in one colour; the
// Script tab's line labels keep what she typed.
const HERS = new Set(['prime', 'me', 'justawoman', 'jawihp']);
export const HER = 'JustAWoman';
export const isHerSpeaker = (speaker) => HERS.has(String(speaker || '').trim().toLowerCase());
/** The name a read or an export shows for a speaker: hers is JustAWoman. */
export const shownSpeaker = (speaker) => (isHerSpeaker(speaker) ? HER : speaker);

// Narration with a colon, not a person (Script page audit, 2026-10-19:
// "Suddenly: the lights go out." was read as Suddenly speaking, and Suddenly
// was listed among the people in the script).
export const NARRATION_WORDS = new Set(['suddenly', 'then', 'later', 'meanwhile', 'finally', 'now', 'again', 'elsewhere', 'outside', 'inside', 'afterwards', 'afterward', 'moments later', 'cut to', 'smash cut', 'flashback', 'montage', 'insert', 'title', 'super', 'pause', 'silence', 'fade in', 'fade out', 'on screen', 'onscreen', 'back to']);
// A name that is not one of the show's people, followed by unquoted words
// that start in lower case and run on (three words or more) is narration.
const NARRATION = /^\p{Ll}\S*(?:\s+\S+){2,}/u;

// A name (one or two capitalised words, any letters), an optional note in
// parentheses, a colon, the words.
// `\p{Lu}`: a capital in any language (`Émile:`; re-audit 2).
const SPEAKER_LINE = /^(Me|Prime|Lala|Kelli|Guest|\p{Lu}[\p{L}'’.-]*(?: \p{Lu}[\p{L}'’.-]*)?)\s*(\([^)]*\))?\s*:\s*(.*)$/u;
// Any name in lower case (`me:`, `lala:`; Script tab audit 6, 2026-10-24):
// a speaker only when it is one of the show's people (KNOWN) or someone in
// the episode's cast, so "then: the lights go out" stays narration.
const LOWER_LINE = /^(\p{L}[\p{L}'’.-]*(?: \p{L}[\p{L}'’.-]*)?)\s*(\([^)]*\))?\s*:\s*(.*)$/u;

// Markdown dress a pasted script can have (Raw editor audit, 2026-10-24):
// `**Me:** words`, `**Lala**: words`, `__Me__: words` name their speaker
// as `Me: words` does. One rule for the Script tab, Rewrite, the runtime,
// the export and the teleprompter (it was the teleprompter's alone).
export const unbold = (line) => String(line ?? '').replace(/^\s*(\*\*|__)\s*([^*_:]+?)\s*(?:\1\s*:|:\s*\1)\s*/, '$2: ');

// A Markdown rule (`---`, `***`, `- - -`, `___`) on a line of its own
// divides, it says nothing: not narration, not a line to read (Raw editor
// audit, 2026-10-24). The server's scriptBeatParser skips the same lines.
const RULE_LINE = /^(?:-[ \t]*){3,}$|^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$/;
export const isRuleLine = (line) => RULE_LINE.test(String(line ?? '').trim());

/**
 * A speaker's line as { speaker, label, note, prefix, words }, or null when
 * the line has no speaker. `speaker` is the person (`Me:` and `LALA:` are
 * Prime and Lala); `label` is the name as written; `note` is `(V.O.)` or
 * null; `prefix` is everything before the words, as written.
 */
export function speakerLine(line, { cast = null } = {}) {
  const t = String(line ?? '').trim();
  // The bold is dropped before the words only, so `prefix` is still the
  // line as written up to them (`**Me:** `).
  const plain = unbold(t).trim();
  let m = plain.match(SPEAKER_LINE);
  let castName = null;
  if (!m) {
    // A lower-case name: one of the show's people, or the cast's (as the cast names them).
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

// The cast's own spelling of a lower-case name, or null. `cast`: names, a Set or an array.
function castNameOf(cast, key) {
  if (!cast) return null;
  for (const n of cast) if (typeof n === 'string' && n.trim().toLowerCase() === key) return n.trim();
  return null;
}

/**
 * The people a script names as speakers with a capital (`Marcus:`), for the
 * same names written in lower case elsewhere (`marcus:`). Her names and
 * Lala's are known without it.
 */
export function scriptCast(lines = []) {
  const out = new Set();
  for (const l of lines) {
    const sp = speakerLine(l);
    if (sp && !KNOWN[sp.label.toLowerCase()] && !HERS.has(sp.label.toLowerCase())) out.add(sp.speaker);
  }
  return out;
}

/** The words without the one pair of quotes around them; a quote inside stays. */
export function unquote(words) {
  const t = String(words ?? '').trim();
  const m = t.match(/^["“]([\s\S]*)["”]$/);
  return m ? m[1].trim() : t;
}
