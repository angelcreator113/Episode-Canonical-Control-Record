/**
 * On-screen moments in the teleprompter (Evoni, 2026-10-23: "when lala is
 * reacting or talking or things are being clicked on screen I need to
 * react"). A script's `[UI:VERB Target]` line is what Lala's screen does;
 * the teleprompter shows it as a reaction cue,
 *   { kind: 'screen', who: null, verb, target, text, icon, seconds: 3 }
 * with `text` in plain words ("Phone comes up", "Notification: Mail") and
 * three seconds for her to react (scaled by "Pace by line times"). Only
 * [UI:] lines: [WEAR:], [STAT:], [TRANSITION:] and the other production tags
 * stay hidden. Pure: no React, no network.
 */
import { parseMoment, messageOf } from './scriptMoments';
import { MOMENT_SECONDS } from './scriptRuntime';

// One length for a [UI:] moment, the runtime's and the teleprompter's
// (Script tab audit 6, 2026-10-24: 2s in the runtime, 3s here).
export const SCREEN_SECONDS = MOMENT_SECONDS;

// The phone itself, as lib/scriptMoments names it.
const PHONE_NAMES = new Set(['phone', 'thephone', 'lalasphone', 'lalaphone', 'phonedevice']);
const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const PHONE_ON = new Set(['SHOW', 'DISPLAY', 'OPEN']);
const TAPS = new Set(['CLICK', 'TAP', 'SELECT']);
const MESSAGES = new Set(['NOTIFY', 'NOTIFICATION', 'DM', 'POST']);

const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "InviteLetterOverlay x2" → "Invite Letter Overlay"; "closet" → "Closet"; underscores read as spaces. */
export function tidyTarget(target) {
  const t = String(target || '').replace(/\s+x\d+$/i, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return capital(t);
}

/** "VOICE_ACTIVATE" → "Voice activate". */
const tidyVerb = (verb) => capital(String(verb || '').toLowerCase().replace(/_+/g, ' ').trim());

const tidyWords = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** A moment in plain words, for the cue. */
export function screenLabel(verb, target) {
  const v = String(verb || '').toUpperCase();
  const isPhone = PHONE_NAMES.has(normKey(String(target || '').replace(/\s+x\d+$/i, '')));
  if (isPhone) return PHONE_ON.has(v) ? 'Phone comes up' : (v === 'HIDE' || v === 'CLOSE' || v === 'REMOVE') ? 'Phone goes away' : `Phone: ${tidyVerb(v).toLowerCase()}`;
  if (MESSAGES.has(v)) {
    const m = messageOf({ verb: v, target });
    if (v === 'POST') return m?.text ? `Posts: ${tidyWords(m.text)}` : 'Posts';
    const head = v === 'DM' ? 'DM' : 'Notification';
    if (m?.who && m?.text) return `${head}: ${tidyWords(m.who)} · “${tidyWords(m.text)}”`;
    const one = tidyWords(m?.text || m?.who || '');
    return one ? `${head}: ${one}` : head;
  }
  const name = tidyTarget(target);
  if (!name) return tidyVerb(v);
  if (v === 'OPEN') return `Lala opens ${name}`;
  if (TAPS.has(v)) return `Lala taps ${name}`;
  if (v === 'SCROLL' || v === 'SWIPE') return `Scrolls ${name}`;
  if (v === 'DISPLAY' || v === 'SHOW') return `Shows ${name}`;
  if (v === 'HIDE' || v === 'REMOVE') return `Hides ${name}`;
  if (v === 'CLOSE') return `Closes ${name}`;
  return `${tidyVerb(v)} ${name}`;
}

/** Which icon the cue wears: phone, notify, dm, post, tap, scroll, open, show, hide or other. */
export function screenIcon(verb, target) {
  const v = String(verb || '').toUpperCase();
  if (PHONE_NAMES.has(normKey(String(target || '').replace(/\s+x\d+$/i, '')))) return 'phone';
  if (v === 'NOTIFY' || v === 'NOTIFICATION') return 'notify';
  if (v === 'DM') return 'dm';
  if (v === 'POST') return 'post';
  if (TAPS.has(v)) return 'tap';
  if (v === 'SCROLL' || v === 'SWIPE') return 'scroll';
  if (v === 'OPEN') return 'open';
  if (v === 'DISPLAY' || v === 'SHOW') return 'show';
  if (v === 'HIDE' || v === 'REMOVE' || v === 'CLOSE') return 'hide';
  return 'other';
}

/** The cue for a `[UI:…]` line, or null for any other line. */
export function screenLine(line) {
  const m = parseMoment(String(line ?? '').trim());
  if (!m) return null;
  return { kind: 'screen', who: null, verb: m.verb, target: m.target, text: screenLabel(m.verb, m.target), icon: screenIcon(m.verb, m.target), seconds: SCREEN_SECONDS };
}
