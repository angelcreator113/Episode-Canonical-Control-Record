/**
 * Reading marks in a teleprompter text (Evoni, 2026-10-20): `//` a pause,
 * `*word*` said with emphasis, `(breath)` or `[breath]` a breath. The
 * teleprompter shows each as a mark, never its characters; in the Script
 * tab they stay plain text (the speaker rule and the runtime read the line
 * as before). Pure: no React.
 */

const MARK = /(\/\/|\*[^*\n]+\*|\(\s*breath\s*\)|\[\s*breath\s*\])/gi;

/**
 * The text as tokens: { t: 'text', v } | { t: 'pause' } | { t: 'em', v } | { t: 'breath' }.
 */
export function markTokens(text) {
  const out = [];
  String(text ?? '').split(MARK).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 0) { out.push({ t: 'text', v: part }); return; }
    if (part === '//') out.push({ t: 'pause' });
    else if (part.startsWith('*')) out.push({ t: 'em', v: part.slice(1, -1) });
    else out.push({ t: 'breath' });
  });
  return out;
}

/** How many `//` pauses the text has (each adds a second, pacing by line times). */
export const pauseCount = (text) => markTokens(text).filter((k) => k.t === 'pause').length;

/** A line that is only a breath: `(breath)` or `[breath]`, or "breath" once its brackets are gone. */
export const isBreath = (text) => /^\s*(?:\(\s*breath\s*\)|\[\s*breath\s*\]|breath)\s*$/i.test(String(text ?? ''));

/** A word as it is matched against what she says: lower case, letters and digits only. */
export const normWord = (w) => String(w || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');

/** The spoken words of the text, in order (marks left out), each { raw, w }. */
export function spokenWords(text) {
  const out = [];
  markTokens(text).forEach((k) => {
    if (k.t !== 'text' && k.t !== 'em') return;
    k.v.split(/\s+/).forEach((raw) => { const w = normWord(raw); if (w) out.push({ raw, w }); });
  });
  return out;
}
