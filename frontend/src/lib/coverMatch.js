/**
 * What the Script tab's "This episode must cover" and the writer's coverage
 * check (src/utils/scriptCoverage.js) call covered (Script tab audit 6,
 * 2026-10-24; Evoni: "smarter matching + manual override"). Pure.
 *
 * src/utils/coverMatch.js is the same code for the server: what lies
 * between BEGIN SHARED and END SHARED is the same word for word
 * (coverMatch.test.js keeps it so), so the tab, the writer's gap-fixer and
 * the story record's "What changed" read a script the same way.
 */
import { personLine } from './scriptRuleChecks';
import { beat14Delivers, stem } from './beat14Invitation';

// BEGIN SHARED
const LIST_BEAT = 9;
const HOOK_BEAT = 14;

// Words that never make a match on their own: the old list, and the
// function words a goal or a hook is written with (Script tab audit 6,
// 2026-10-24: "must", "whether", "before" ticked a hook in any beat).
const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'her', 'his', 'their', 'your', 'about', 'post', 'piece', 'content', 'make', 'made', 'lala', 'episode', 'event',
  'must', 'whether', 'before', 'after', 'what', 'they', 'them', 'then', 'than', 'here', 'there', 'when', 'where', 'which', 'while', 'will', 'would', 'could', 'should',
  'have', 'has', 'had', 'been', 'being', 'were', 'just', 'also', 'more', 'most', 'some', 'very', 'over', 'such', 'only', 'each', 'these', 'those', 'does', 'doing',
  'done', 'want', 'wants', 'need', 'needs', 'onto', 'upon', 'ours', 'yours', 'theirs', 'other', 'another', 'still', 'even', 'ever', 'next', 'once', 'again',
  'because', 'until', 'though', 'through', 'without', 'within',
]);
const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const stems = (s) => words(s).map(stem);
/** The text's key words, stemmed: four letters or more, no stop word. */
const keyWords = (s) => [...new Set(words(s).filter((w) => w.length >= 4 && !STOP.has(w)).map(stem))];
// All of one or two; three quarters of more.
const needOf = (n) => (n <= 2 ? n : Math.ceil(n * 0.75));
// How many of the key words the text has.
const hits = (text, keys) => { const have = new Set(stems(text)); return keys.filter((k) => have.has(k)).length; };
// Whether the stemmed phrase is in the text, its words in a row.
function hasPhrase(text, phrase) {
  if (!phrase.length) return true;
  const have = stems(text);
  for (let i = 0; i + phrase.length <= have.length; i += 1) {
    if (phrase.every((w, j) => have[i + j] === w)) return true;
  }
  return false;
}

/** The first beat (its number) whose lines mention the text, else null. `beats`: [{ number, lines }]. */
function mentionedIn(beats = [], text) {
  const keys = keyWords(text);
  if (!keys.length) return null;
  const need = needOf(keys.length);
  for (const b of beats || []) {
    if (hits((b?.lines || []).join(' '), keys) >= need) return b.number;
  }
  return null;
}

// A line of the to-do list (beat 9's, or its recap later): ticking the list
// is not doing the goal (Script tab audit 6, 2026-10-24).
const LIST_LINE = /\b(?:to-?\s?do|checklist|check list|reminders?|task list|(?:my|the|her) list)\b|^\s*(?:[-*•]\s*)?(?:\[[ xX✓]?\]|[☐☑✓✔])/i;
const LIST_UI = /^\s*\[UI:\s*(?:CHECK|CHECK_ITEM)\b/i;
const isListLine = (line) => LIST_LINE.test(line) || LIST_UI.test(line);
// A DM or notification and who it is from.
const MESSAGE_FROM = /^\s*\[UI:\s*(?:DM|NOTIFY|NOTIFICATION)\s+([^:\]]*?)\s*:/i;
// A message from the goal's person is them reaching out, not Lala working
// the room (Script tab audit 6, 2026-10-24). With nobody known, a sender
// whose name is all in the goal's words is the person.
function fromThem(line, person, labelStems) {
  const m = String(line).match(MESSAGE_FROM);
  if (!m || !m[1] || /^lala\b/i.test(m[1])) return false;
  if (person?.names?.length) return !!personLine([`${m[1]}: …`], person);
  const sender = stems(m[1]);
  return sender.length > 0 && sender.every((w) => labelStems.has(w));
}

const ARTICLES = new Set(['a', 'an', 'the', 'some', 'her', 'his', 'their', 'my', 'our']);
const TRAILING = new Set(['with', 'to', 'at', 'for', 'about', 'on', 'in', 'from', 'of', 'by', 'and', 'into']);
/**
 * The goal's verb phrase, stemmed: its words before the person's or the
 * brand's name ("Get to know Truthville" → get to know; "Co-style a moment
 * with Velour" → co style; "Follow up with Studio by Sable" → follow up).
 * The name is the person's (person.names) where the label has it, else the
 * first capitalised word after the first; up to an article, without the
 * preposition before the name. [] when there is none.
 */
function verbPhrase(label, person = null) {
  const raw = String(label || '');
  const ws = words(raw);
  if (ws.length < 2) return ws.map(stem);
  let at = ws.length;
  for (const n of person?.names || []) {
    const nw = words(n);
    if (!nw.length) continue;
    for (let i = 1; i + nw.length <= ws.length && i < at; i += 1) {
      if (nw.every((w, j) => ws[i + j] === w)) { at = i; break; }
    }
  }
  if (at === ws.length) {
    const toks = raw.normalize('NFKD').replace(/[^A-Za-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (toks.length === ws.length) {
      const cap = toks.findIndex((t, i) => i > 0 && /^[A-Z]/.test(t));
      if (cap > 0) at = cap;
    }
  }
  let phrase = ws.slice(0, at);
  const article = phrase.findIndex((w, i) => i > 0 && ARTICLES.has(w));
  if (article > 0) phrase = phrase.slice(0, article);
  while (phrase.length > 1 && TRAILING.has(phrase[phrase.length - 1])) phrase = phrase.slice(0, -1);
  return phrase.map(stem);
}

/**
 * The line that shows a covered goal, { line, as }: the one with the verb
 * phrase and most of the goal's key words, the person's (personLine) first
 * when two score the same; `mustName`, only lines where the person is.
 */
function coveringLine(lines, keys, verb, person, { mustName = false } = {}) {
  let best = null;
  for (const l of lines) {
    const named = personLine([l], person);
    if (mustName && !named) continue;
    const score = hits(l, keys) + (named ? 0.5 : 0) + (verb.length && hasPhrase(l, verb) ? 1 : 0);
    if ((score > 0 || mustName) && (!best || score > best.score)) best = { score, line: l, as: named?.as || null };
  }
  return best ? { line: best.line, as: best.as } : null;
}

/**
 * Where a relationship goal (or a follow-up carried from an earlier
 * episode) is covered, { beat, as, line } or null. Covered in a beat when
 * the goal's verb phrase is there as a phrase (verbPhrase) and either the
 * goal is mentioned as written (its key words, the rule above; a brand's
 * needs the brand named, person.whole) or the rest of its words are and the
 * person is there by any of their names, or speaks (personLine). The to-do
 * beat (9) and the list's lines elsewhere are not the goal being done, nor
 * is a DM or notification from the person. The latest such beat is named,
 * so a goal done in the event (beat 10 on) is "covered in" that beat, not
 * where it was first planned. `line` is the beat's line that shows it, `as`
 * the name the person goes by in it (null when they are not named there).
 * Script tab audit 6 (2026-10-24); Evoni, 2026-10-23 for the person.
 */
function goalMatch(beats = [], goal, person = null) {
  const label = String(goal?.label || '').trim();
  const keys = keyWords(label);
  const verb = verbPhrase(label, person);
  if (!keys.length && !verb.length) return null;
  const verbSet = new Set(verb);
  const labelStems = new Set(stems(label));
  const own = new Set((person?.names || []).flatMap(stems));
  const nonVerb = keys.filter((k) => !verbSet.has(k));
  const rest = nonVerb.filter((k) => !own.has(k));
  const latestFirst = (beats || []).filter((b) => b && b.number !== LIST_BEAT).slice().sort((a, b) => b.number - a.number);
  for (const b of latestFirst) {
    const lines = (b.lines || []).map((l) => String(l ?? '')).filter((l) => l.trim() && !isListLine(l) && !fromThem(l, person, labelStems));
    if (!lines.length || (verb.length && !lines.some((l) => hasPhrase(l, verb)))) continue;
    const text = lines.join(' ');
    const named = person?.names?.length ? personLine(lines, person) : null;
    const literal = hits(text, nonVerb) >= needOf(nonVerb.length) && (!person?.whole || !!named);
    const byPerson = !!named && hits(text, rest) >= needOf(rest.length);
    if (!literal && !byPerson) continue;
    const shown = coveringLine(lines, keys, verb, person, { mustName: !literal });
    return { beat: b.number, as: shown?.as || null, line: shown?.line || null };
  }
  return null;
}

/**
 * Whether beat 14 tells the forward hook (Script tab audit 6, 2026-10-24):
 * only beat 14 counts; it is paraphrased, so half of its key words will do;
 * and with the opportunity attached, the invitation beat 14 delivers is how
 * it is told (beat14Delivers). 14 or null.
 */
function hookCovered(beats = [], hook, opportunity = null) {
  const b = (beats || []).find((x) => x?.number === HOOK_BEAT);
  if (!b) return null;
  if (opportunity && beat14Delivers(beats, opportunity)) return HOOK_BEAT;
  const keys = keyWords(hook);
  if (!keys.length) return null;
  return hits((b.lines || []).join(' '), keys) >= Math.max(1, Math.ceil(keys.length / 2)) ? HOOK_BEAT : null;
}

/**
 * The stable key a cover item's manual mark is kept under (episode_briefs.
 * event_metadata.cover_marks): a goal by its slot and its words, a
 * follow-up by its id, and 'opportunity' and 'hook'.
 */
function coverKey(kind, item = {}) {
  if (kind === 'goal') return `goal:${item.slot || 'relationship'}:${words(item.label).join('-')}`;
  if (kind === 'carried') return `carried:${item.follow_up_id}`;
  return kind;
}

/**
 * An item with its manual mark (Evoni, 2026-10-24: "smarter matching +
 * manual override"): the mark wins. Marked covered, it is covered (in the
 * beat she named, else the beat matched, else none named); marked not
 * covered, it is a gap whatever the words say. `marks`: { [coverKey]:
 * { covered, beat?, at, by } }. The item gets `covered` (true/false) and,
 * when marked, `marked`: { covered, at, by } and `matched` (the beat the
 * words gave, or null).
 */
function withMark(item, marks) {
  const m = marks && typeof marks === 'object' ? marks[item.markKey] : null;
  if (!m || typeof m.covered !== 'boolean') return { ...item, covered: item.beat != null };
  const marked = { covered: m.covered, at: m.at || null, by: m.by || null };
  const beat = Number.isInteger(m.beat) && m.beat >= 1 && m.beat <= 14 ? m.beat : null;
  if (m.covered) return { ...item, covered: true, beat: beat ?? item.beat ?? null, matched: item.beat ?? null, marked };
  const { line: _line, mark: _mark, who: _who, ...rest } = item;
  return { ...rest, covered: false, beat: null, matched: item.beat ?? null, marked };
}
// END SHARED

export { LIST_BEAT, HOOK_BEAT, STOP, words, keyWords, mentionedIn, verbPhrase, goalMatch, hookCovered, coverKey, withMark, isListLine };
