/**
 * Follow my voice (Evoni, 2026-10-20): the words the browser hears, matched
 * against the words still to say, so the teleprompter moves with her. A
 * heard word moves the place on only when it is one of the next few words
 * (a skipped word or two is fine); it never moves back. Pure: no React.
 */
import { normWord } from './teleprompterMarks';

/** How far ahead a heard word may match (words she skipped). */
export const LOOK_AHEAD = 8;

// One letter wrong, missing or extra (the recogniser's near misses).
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Whether a heard word is the script's word: the same, one letter off (4+ letters), or sharing a 5-letter start. */
export function sameWord(script, heard) {
  const a = normWord(script);
  const b = normWord(heard);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && oneEdit(a, b)) return true;
  return a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5);
}

/**
 * The place after hearing `heard` (words, in order): `cursor` is the index
 * of the next word to say in `words` ([{ w }]). A short word (one or two
 * letters) moves the place only when it is the very next word, so a stray
 * "a" does not jump ahead.
 */
export function advance(words, cursor, heard) {
  let at = Math.max(0, cursor);
  for (const h of heard) {
    const w = normWord(h);
    if (!w) continue;
    const reach = w.length <= 2 ? 1 : LOOK_AHEAD;
    for (let j = at; j < Math.min(words.length, at + reach); j += 1) {
      if (sameWord(words[j].w, w)) { at = j + 1; break; }
    }
  }
  return at;
}

/** The recognition constructor this browser has, or null. */
export function speechRecognition(win = typeof window !== 'undefined' ? window : {}) {
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

/** A recognition error in plain words; null for the ones to ignore. */
export function speechErrorMessage(code, { recording = false } = {}) {
  switch (code) {
    case 'no-speech':
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'The microphone is blocked for Follow my voice. Allow it for this site in the browser, then try again.';
    case 'audio-capture':
      return recording
        ? "This browser can't listen while it records. Switch Follow my voice off to record, or record without it."
        : 'No microphone was found for Follow my voice.';
    case 'network':
      return 'Follow my voice needs the internet in this browser. Check the connection.';
    case 'language-not-supported':
      return "Follow my voice doesn't support this language in this browser.";
    default:
      return 'Follow my voice stopped. Press Play to try again.';
  }
}
