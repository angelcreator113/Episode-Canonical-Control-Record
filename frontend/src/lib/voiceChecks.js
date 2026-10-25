/**
 * Voice drift (Evoni, 2026-10-25, "character voices that learn"): the
 * learned rules a script can be checked against, line by line, for "Ready to
 * film?". A rule's check_json is one of
 *   { type: 'max_sentences', n }                      a line of theirs is at most n sentences
 *   { type: 'banned_word', word }                     a word they never say (whole word, any case)
 *   { type: 'uses_phrase', phrase, every_n_lines }    a phrase they say at least every n lines
 * A rule names its character by characterKey; a script names them by its
 * speaker label (`Me:`, `Lala:`, `Marcus:`), which GET /voice/speakers maps
 * to a key. Her labels are always 'justawoman' and `Lala` is always 'lala'.
 *
 * Pure: no requests, nothing thrown on odd input.
 */
import { speakerLine, unquote, isRuleLine } from './scriptSpeaker';
import { isCutsceneBeat } from './scriptShowRules';
import { isHerKey, HER_KEY } from './characterVoice';

const lower = (v) => String(v ?? '').trim().toLowerCase();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Sentences in a line: runs of words ended by . ! ? (an ellipsis or "?!" is one end). */
export function countSentences(text) {
  const t = String(text ?? '').replace(/["“”]/g, '').trim();
  if (!t) return 0;
  return t.split(/(?:[.!?…]+)(?=\s|$)/u).filter((part) => /[\p{L}\p{N}]/u.test(part)).length;
}

/** Whether `word` is in `text` as a whole word, any case. */
export function hasWord(text, word) {
  const w = String(word ?? '').trim();
  if (!w) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escape(w)}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(String(text ?? ''));
}

const flat = (s) => lower(s).replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
/** Whether `phrase` is in `text`, any case and spacing. */
export const hasPhrase = (text, phrase) => !!flat(phrase) && flat(text).includes(flat(phrase));

/**
 * Speaker label (lower case) to { characterKey, name }, from GET
 * /voice/speakers, with her labels and Lala's known without it.
 */
export function speakerKeys(speakers = []) {
  const map = new Map();
  for (const label of ['me', 'prime', 'justawoman', 'jawihp']) map.set(label, { characterKey: HER_KEY, name: 'JustAWoman' });
  map.set('lala', { characterKey: 'lala', name: 'Lala' });
  for (const s of Array.isArray(speakers) ? speakers : []) {
    if (!s || !s.speaker || !s.characterKey) continue;
    const label = lower(s.speaker);
    if (isHerKey(label)) continue; // hers stay hers
    map.set(label, { characterKey: s.characterKey, name: s.name || s.speaker });
  }
  return map;
}

/** The rule's check, or null when it is not one a script can check. */
export function checkOf(rule) {
  let c = rule?.check_json;
  if (typeof c === 'string') {
    try { c = JSON.parse(c); } catch (err) { console.error('[voiceChecks] check_json is not JSON:', err); return null; }
  }
  if (!c || typeof c !== 'object') return null;
  if (c.type === 'max_sentences' && Number(c.n) > 0) return { type: c.type, n: Number(c.n) };
  if (c.type === 'banned_word' && String(c.word || '').trim()) return { type: c.type, word: String(c.word).trim() };
  if (c.type === 'uses_phrase' && String(c.phrase || '').trim() && Number(c.every_n_lines) > 0) {
    return { type: c.type, phrase: String(c.phrase).trim(), every: Number(c.every_n_lines) };
  }
  return null;
}

/** The context a beat is in: beats 11-13 are the cutscene, the rest gameplay. */
export const beatContext = (beat) => (isCutsceneBeat(beat?.number) ? 'cutscene' : 'gameplay');
const applies = (rule, context) => !rule.context || rule.context === context;

/**
 * Every spoken line of the script, in order: { beatIndex, beatId, beatNumber,
 * lineNumber, context, characterKey, name, words }. `lineNumber` is the
 * line's place among the beat's shown lines (as the Script tab numbers them:
 * blank lines, `---` and [STAT:]/[MAIL:] tags are not counted).
 */
export function spokenLines(beats = [], speakers = []) {
  const keys = speakerKeys(speakers);
  const out = [];
  (Array.isArray(beats) ? beats : []).forEach((beat, beatIndex) => {
    let shown = 0;
    for (const raw of Array.isArray(beat?.lines) ? beat.lines : []) {
      const t = typeof raw === 'string' ? raw.trim() : '';
      if (!t || isRuleLine(t) || /^\[STAT:|^\[MAIL:/i.test(t)) continue;
      shown += 1;
      const sp = speakerLine(t);
      if (!sp || !sp.words) continue;
      const who = keys.get(lower(sp.speaker)) || keys.get(lower(sp.label));
      if (!who) continue;
      out.push({
        beatIndex, beatId: beat.id || null, beatNumber: beat.number ?? beatIndex + 1, lineNumber: shown,
        context: beatContext(beat), characterKey: who.characterKey, name: who.name, words: unquote(sp.words),
      });
    }
  });
  return out;
}

/**
 * The lines that break a checkable rule. Each flag:
 * { ruleId, characterKey, type, beatId, beatNumber, lineNumber, severity, text }.
 * max_sentences and banned_word flag each line; uses_phrase is one low note
 * per character, when every_n_lines of theirs in a row go without it.
 */
export function voiceDriftFlags({ beats = [], rules = [], speakers = [] } = {}) {
  const lines = spokenLines(beats, speakers);
  const flags = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    const check = rule && checkOf(rule);
    if (!check || !rule.characterKey) continue;
    const theirs = lines.filter((l) => l.characterKey === rule.characterKey && applies(rule, l.context));
    if (!theirs.length) continue;
    const name = theirs[0].name;
    if (check.type === 'max_sentences') {
      for (const l of theirs) {
        if (countSentences(l.words) > check.n) {
          flags.push({ ruleId: rule.id, characterKey: rule.characterKey, type: check.type, beatId: l.beatId, beatNumber: l.beatNumber, lineNumber: l.lineNumber, severity: 'normal',
            text: `${name} usually keeps it to ${check.n} ${check.n === 1 ? 'sentence' : 'sentences'} — beat ${l.beatNumber}, line ${l.lineNumber}` });
        }
      }
    } else if (check.type === 'banned_word') {
      for (const l of theirs) {
        if (hasWord(l.words, check.word)) {
          flags.push({ ruleId: rule.id, characterKey: rule.characterKey, type: check.type, beatId: l.beatId, beatNumber: l.beatNumber, lineNumber: l.lineNumber, severity: 'normal',
            text: `${name} doesn't say “${check.word}” — beat ${l.beatNumber}, line ${l.lineNumber}` });
        }
      }
    } else if (check.type === 'uses_phrase') {
      let run = 0;
      let from = null;
      for (const l of theirs) {
        if (hasPhrase(l.words, check.phrase)) { run = 0; from = null; continue; }
        if (!run) from = l;
        run += 1;
        if (run >= check.every) {
          flags.push({ ruleId: rule.id, characterKey: rule.characterKey, type: check.type, beatId: from.beatId, beatNumber: from.beatNumber, lineNumber: from.lineNumber, severity: 'low',
            text: `${name} usually says “${check.phrase}” every ${check.every} lines — ${check.every} lines in a row without it from beat ${from.beatNumber}, line ${from.lineNumber}` });
          break; // one note per character
        }
      }
    }
  }
  return flags;
}

/**
 * The flags as "Ready to film?" rows (lib/scriptHealth): one row per rule
 * and beat, its first line and how many more; a uses_phrase note is `low`
 * and names no beat, so it does not mark a beat for revision. With rules
 * checked and nothing broken, one OK row.
 */
export function voiceHealthRows({ beats = [], rules = null, speakers = [] } = {}) {
  if (!Array.isArray(rules) || !rules.some((r) => checkOf(r))) return [];
  const flags = voiceDriftFlags({ beats, rules, speakers });
  if (!flags.length) {
    return spokenLines(beats, speakers).length ? [{ key: 'voice-drift', ok: true, beatId: null, text: 'Everyone sounds like themselves.' }] : [];
  }
  const groups = new Map();
  for (const f of flags) {
    const k = f.severity === 'low' ? `low-${f.ruleId}` : `${f.ruleId}-${f.beatId ?? f.beatNumber}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  return [...groups.entries()].map(([k, list]) => {
    const f = list[0];
    const more = list.length > 1 ? ` (+${list.length - 1} more in this beat)` : '';
    return f.severity === 'low'
      ? { key: `voice-drift-${k}`, ok: false, low: true, beatId: null, text: f.text }
      : { key: `voice-drift-${k}`, ok: false, beatId: f.beatId, text: `${f.text}${more}` };
  });
}
