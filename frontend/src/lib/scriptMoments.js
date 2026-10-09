/**
 * What is on screen in a script beat (Evoni, 2026-10-09: "when I'm writing my
 * script I'm not able to inject things from lala's phone … I also need to
 * know when and which overlays will be showing on screen"; Task #2789).
 *
 * A script says what the screen does with a UI line, `[UI:VERB Target]`, the
 * grammar the script skeleton, the script parser (src/utils/scriptBeatParser)
 * and the ScriptEditor already use: `[UI:OPEN closet]`, `[UI:CLICK MailIcon]`,
 * `[UI:DISPLAY InviteLetterOverlay]`. The Script tab reads each one as a
 * moment and finds what it names among the episode's Lala's Phone screens
 * (GET /ui-overlays/:showId?episode_id=) and its overlays (GET
 * /episodes/:id/overlays), so the line shows that screen's picture.
 */

const UI_LINE = /^\s*\[UI:\s*([A-Za-z_]+)\s*(.*?)\s*\]\s*$/;

/** The UI line's verb and target, or null for any other line. */
export function parseMoment(line) {
  const m = String(line || '').match(UI_LINE);
  if (!m) return null;
  return { verb: m[1].toUpperCase(), target: m[2] };
}

/** A key compared the way the server compares overlay names (timelinePlacementService.normalizeOverlayKey). */
export const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// The verbs the pickers write, and how every verb reads on the card.
export const PHONE_VERBS = [
  { verb: 'OPEN', label: 'Opens' },
  { verb: 'CLICK', label: 'Taps' },
  { verb: 'SCROLL', label: 'Scrolls' },
  { verb: 'CLOSE', label: 'Closes' },
];
// An overlay stays on screen from Shows until Hides (Task #2793).
export const OVERLAY_VERBS = [{ verb: 'DISPLAY', label: 'Shows' }, { verb: 'HIDE', label: 'Hides' }];
const VERB_LABELS = {
  OPEN: 'Opens', CLICK: 'Taps', TAP: 'Taps', SCROLL: 'Scrolls', DISPLAY: 'Shows', SHOW: 'Shows',
  CLOSE: 'Closes', HIDE: 'Hides', REMOVE: 'Hides', TYPE: 'Types', CHECK: 'Checks', CHECK_ITEM: 'Checks', NOTIFY: 'Notifies', SWIPE: 'Swipes',
  NOTIFICATION: 'Notification:', SELECT: 'Selects', HOVER: 'Hovers on', PULSE: 'Pulses', VOICE_ACTIVATE: 'Voice-activates',
};
export const verbLabel = (verb) => VERB_LABELS[String(verb || '').toUpperCase()]
  || String(verb || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// The generators' targets carry generic words ("InviteLetterOverlay",
// "MailPanel", "LoginWindow"); without them the name is what to look for.
const GENERIC = new Set(['overlay', 'letter', 'panel', 'window', 'screen', 'icon', 'items', 'item', 'category', 'app']);
function targetStem(target) {
  const words = String(target || '').replace(/\s+x\d+$/i, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const kept = words.filter((w) => !GENERIC.has(w.toLowerCase()));
  return normKey((kept.length ? kept : words).join(''));
}
const sharedStart = (a, b) => { let n = 0; while (n < a.length && a[n] === b[n]) n += 1; return n; };

/**
 * What a moment shows: { kind: 'phone' | 'overlay', name, url } for the phone
 * screen or overlay its target names, else null. A target matches by key or
 * name ignoring case and punctuation; failing that, by its name without the
 * generic words, contained in a key or sharing its first five letters
 * ("InviteLetterOverlay" finds the Invitation), the closest match first.
 */
export function resolveMoment(moment, { screens = [], overlays = [] } = {}) {
  if (!moment) return null;
  // "ClosetItems x5" names ClosetItems.
  const target = normKey(String(moment.target || '').replace(/\s+x\d+$/i, ''));
  if (!target) return null;
  const stem = targetStem(moment.target);
  const options = [
    ...screens.map((s) => ({ kind: 'phone', keys: [s.id, s.name], name: s.name || s.id, url: s.url || null })),
    ...overlays.map((o) => ({ kind: 'overlay', keys: [o.key, o.label], name: o.label || o.key, url: o.image_url || null })),
  ].map((o) => ({ ...o, keys: o.keys.map(normKey).filter(Boolean) }));
  const exact = options.find((o) => o.keys.includes(target));
  if (exact) return { kind: exact.kind, name: exact.name, url: exact.url };
  const score = (k) => {
    if (k.length < 4 || stem.length < 4) return 0;
    if (k === stem) return 1000;
    if (stem.includes(k) || k.includes(stem)) return 500 + Math.min(k.length, stem.length);
    const shared = sharedStart(k, stem);
    return shared >= 5 ? shared : 0;
  };
  const loose = options
    .flatMap((o) => o.keys.map((k) => ({ o, s: score(k) })))
    .filter((c) => c.s > 0)
    .sort((a, b) => b.s - a.s)[0];
  return loose ? { kind: loose.o.kind, name: loose.o.name, url: loose.o.url } : null;
}

const OFF_VERBS = new Set(['HIDE', 'REMOVE', 'CLOSE']);

/**
 * What is on screen through a beat (Evoni, 2026-10-09: "some beats use
 * multiple overlays and Lala's phone between lines within a beat. And certain
 * overlays help build the full scene"; Task #2793). Walking the beat's lines
 * in order: a moment that shows something puts it on screen, Hides / Closes
 * takes it off, and Lala's phone is one screen at a time. Returns, per line
 * index, the names on screen with that line's moment (itself excluded), and
 * every screen or overlay the beat uses, in order of first appearance.
 */
export function beatOnScreen(lines = [], on = {}) {
  const showing = new Map(); // name -> kind, in the order they came on
  const withByLine = {};
  const used = new Map();
  lines.forEach((line, i) => {
    const moment = parseMoment(line);
    if (!moment) return;
    const shown = resolveMoment(moment, on);
    const name = shown ? shown.name : moment.target;
    if (shown && !used.has(name)) used.set(name, shown);
    if (OFF_VERBS.has(moment.verb)) {
      showing.delete(name);
    } else {
      if (shown?.kind === 'phone') {
        for (const [n, k] of showing) if (k === 'phone') showing.delete(n);
      }
      showing.set(name, shown?.kind || 'unknown');
    }
    withByLine[i] = [...showing.keys()].filter((n) => n !== name);
  });
  return { withByLine, used: [...used.entries()].map(([name, s]) => ({ name, kind: s.kind, url: s.url })) };
}

/** The UI line a picker writes: the verb and the screen's or overlay's key. */
export function momentLine(verb, target) {
  return `[UI:${String(verb || 'OPEN').toUpperCase()} ${String(target || '').trim()}]`;
}

/**
 * What each canonical beat puts on screen (src/constants/canonicalBeats.js:
 * screen_action and surface; tests/unit/constants/frontend-script-moments
 * keeps the two in step). Shown on the beat as a hint, never written.
 */
export const EXPECTED_ON_SCREEN = {
  1: { action: 'HEADPHONES_ON', what: 'Headphones on', where: 'Host Environment' },
  2: { action: 'LOGIN', what: 'The login', where: 'Full Screen' },
  3: { action: 'WELCOME', what: 'The welcome', where: null },
  4: { action: 'MAIL_NOTIFICATION', what: 'A mail notification', where: "Lala's Phone" },
  5: { action: 'OPEN_LETTER_INVITE_OVERLAY', what: 'The invitation letter, opened', where: "Lala's Phone → Full Screen" },
  6: { action: 'LALA_VOICE_COMMAND', what: "Lala's voice command", where: "Lala's Environment" },
  7: { action: 'SIDE_QUEST', what: 'A side quest', where: "Lala's Phone" },
  8: { action: 'CLOSET_OPEN', what: 'The closet', where: "Lala's Phone" },
  9: { action: 'TODO_LIST', what: 'The to-do list', where: "Lala's Phone" },
  10: { action: 'LOCATION_ICON', what: 'The location', where: "Lala's Phone" },
  11: { action: 'ARRIVAL', what: 'Arriving', where: "Lala's Environment" },
  12: { action: 'CONTENT_CREATE', what: 'Making the content', where: "Lala's Phone" },
  13: { action: 'STATS_UPDATE', what: 'The stats update', where: 'Full Screen' },
  14: { action: 'FADE_OUT', what: 'The fade out', where: 'Full Screen' },
};
