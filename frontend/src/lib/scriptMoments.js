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
// The phone itself, not one of its screens (Evoni, 2026-10-09: "I have no
// way of the script knowing when the actual phone will be on screen";
// Task #2797): [UI:SHOW phone] brings it up, [UI:HIDE phone] takes it away.
export const PHONE_KEY = 'phone';
const PHONE_NAMES = new Set(['phone', 'thephone', 'lalasphone', 'lalaphone', 'phonedevice']);
export const PHONE_NAME = "Lala's phone";
export const DEVICE_VERBS = [{ verb: 'SHOW', label: 'Comes on screen' }, { verb: 'HIDE', label: 'Goes away' }];
const DEVICE_ON = new Set(['SHOW', 'DISPLAY', 'OPEN']);
/** How a moment of the phone itself reads: "Comes on screen", "Goes away". */
export const deviceLabel = (verb) => (DEVICE_ON.has(String(verb || '').toUpperCase()) ? 'Comes on screen' : 'Goes away');

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
export function resolveMoment(moment, on = {}) {
  const { screens = [], overlays = [], icons = [] } = on;
  if (!moment) return null;
  // "ClosetItems x5" names ClosetItems.
  const target = normKey(String(moment.target || '').replace(/\s+x\d+$/i, ''));
  if (!target) return null;
  if (PHONE_NAMES.has(target)) return { kind: 'device', name: PHONE_NAME, url: on.phoneFrame || null };
  const stem = targetStem(moment.target);
  // A tap is on an icon first (Task #2801); any other verb finds a screen or
  // an overlay first, and an icon after them.
  const iconOptions = icons.map((i) => ({ kind: 'icon', keys: [i.key, i.name], name: i.name, url: i.url, icon: i }));
  const others = [
    ...screens.map((s) => ({ kind: 'phone', keys: [s.id, s.name], name: s.name || s.id, url: s.url || null })),
    ...overlays.map((o) => ({ kind: 'overlay', keys: [o.key, o.label], name: o.label || o.key, url: o.image_url || null })),
  ];
  const options = (TAP_VERBS.has(moment.verb) ? [...iconOptions, ...others] : [...others, ...iconOptions])
    .map((o) => ({ ...o, keys: o.keys.map(normKey).filter(Boolean) }));
  const found = (o) => (o.kind === 'icon'
    ? { kind: 'icon', name: o.name, url: o.url, opens: o.icon.opensName, on: o.icon.onName }
    : { kind: o.kind, name: o.name, url: o.url });
  const exact = options.find((o) => o.keys.includes(target));
  if (exact) return found(exact);
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
  return loose ? found(loose.o) : null;
}

const TAP_VERBS = new Set(['CLICK', 'TAP', 'SELECT']);

/**
 * The icons on Lala's phone (Evoni, 2026-10-09: "instead of lala's phone
 * screens showing I think we need to show the icons because we have the icons
 * that then link to the screen … some of them are one steps and some of them
 * are two steps"; Task #2801). Each screen's tap zones (screen_links, the
 * Phone Hub's icons) open another screen: the zone's navigate action, else
 * its target, as the phone runs it (src/services/phoneRuntime actionsForZone).
 * Walking from the home screen (is_home) one tap at a time gives every icon
 * the taps that reach it: an icon on the home screen, or pinned there to
 * every screen (persistent), is one tap; an icon inside Mail is Mail's tap,
 * then its own.
 *
 * Returns [{ key, name, url, on, onName, opens, opensName, path }] in the
 * order a tap reaches them; path is the icons' keys from home, this one last.
 * `iconArt` is the icon library (the list route's phone_icon overlays), for
 * each zone's current picture.
 */
export function phoneIcons(screens = [], iconArt = []) {
  const byId = new Map(screens.map((s) => [s.id, s]));
  const nameOf = (id) => byId.get(id)?.name || id || null;
  const linksOf = (s) => (s?.screen_links || s?.metadata?.screen_links || []).filter((z) => z && typeof z === 'object');
  const opensOf = (z) => {
    const nav = Array.isArray(z.actions) ? z.actions.find((a) => a?.type === 'navigate' && a.target) : null;
    return nav ? nav.target : (z.target || null);
  };
  const artOf = (z) => {
    const art = z.icon_overlay_id ? iconArt.find((i) => i.id === z.icon_overlay_id) : null;
    return art?.url || z.icon_url || (Array.isArray(z.icon_urls) ? z.icon_urls[0] : null) || null;
  };
  const home = screens.find((s) => s.is_home) || null;
  const icons = [];
  const seenKey = new Set();
  const add = (z, screen, pathBefore) => {
    const name = String(z.label || iconArt.find((i) => i.id === z.icon_overlay_id)?.name || nameOf(opensOf(z)) || '').trim();
    if (!name) return null;
    let key = z.icon_overlay_id || normKey(name) || z.id;
    if (seenKey.has(key)) key = `${key}_${normKey(screen?.name || screen?.id || '')}`;
    if (seenKey.has(key)) return null;
    seenKey.add(key);
    const icon = {
      key, name, url: artOf(z), on: screen ? screen.id : null, onName: screen ? (z.persistent && screen === home ? 'Every screen' : nameOf(screen.id)) : null,
      opens: opensOf(z), opensName: nameOf(opensOf(z)), path: [...pathBefore, key],
    };
    icons.push(icon);
    return icon;
  };
  // Breadth first from home: the fewest taps to each screen.
  const pathTo = new Map();
  const queue = [];
  if (home) { pathTo.set(home.id, []); queue.push(home.id); }
  while (queue.length) {
    const id = queue.shift();
    const screen = byId.get(id);
    for (const z of linksOf(screen)) {
      const icon = add(z, screen, pathTo.get(id));
      const next = icon?.opens;
      if (next && byId.has(next) && !pathTo.has(next)) { pathTo.set(next, icon.path); queue.push(next); }
    }
  }
  // Icons on screens no tap from home reaches: their own tap only.
  for (const screen of screens) {
    if (pathTo.has(screen.id)) continue;
    for (const z of linksOf(screen)) add(z, screen, []);
  }
  return icons;
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
 *
 * The phone itself (Task #2797) carries from beat to beat: phoneUp says
 * whether it is on screen as the beat starts, phoneUpAtEnd whether it still
 * is when the beat ends. Taking it away takes its screens with it, and a
 * phone screen opened while it is not on screen is listed in phoneDownAt.
 */
export function beatOnScreen(lines = [], on = {}, { phoneUp = false } = {}) {
  const showing = new Map(); // name -> kind, in the order they came on
  if (phoneUp) showing.set(PHONE_NAME, 'device');
  let up = phoneUp;
  const withByLine = {};
  const phoneDownAt = [];
  const used = new Map();
  lines.forEach((line, i) => {
    const moment = parseMoment(line);
    if (!moment) return;
    const shown = resolveMoment(moment, on);
    const name = shown ? shown.name : moment.target;
    if (shown && !used.has(name)) used.set(name, shown);
    if (shown?.kind === 'icon') {
      // Tapping an icon (Task #2801) opens its screen on the phone.
      if (!up) phoneDownAt.push(i);
      if (shown.opens) {
        for (const [n, k] of showing) if (k === 'phone') showing.delete(n);
        showing.set(shown.opens, 'phone');
      }
      withByLine[i] = [...showing.keys()].filter((n) => n !== shown.opens);
      return;
    }
    if (shown?.kind === 'device') {
      up = DEVICE_ON.has(moment.verb);
      if (up) showing.set(name, 'device');
      else for (const [n, k] of showing) if (k === 'device' || k === 'phone') showing.delete(n);
    } else if (OFF_VERBS.has(moment.verb)) {
      showing.delete(name);
    } else {
      if (shown?.kind === 'phone') {
        if (!up) phoneDownAt.push(i);
        for (const [n, k] of showing) if (k === 'phone') showing.delete(n);
      }
      showing.set(name, shown?.kind || 'unknown');
    }
    withByLine[i] = [...showing.keys()].filter((n) => n !== name);
  });
  return {
    withByLine,
    phoneDownAt,
    phoneUpAtEnd: up,
    used: [...used.entries()].map(([name, s]) => ({ name, kind: s.kind, url: s.url })),
  };
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

/**
 * The script's closet beat (Task #2880): the beat whose lines open the closet
 * (`[UI:OPEN Closet…]`, as the script skeleton writes it), else the beat whose
 * canonical number is the one that opens it (CLOSET_OPEN). Numbered as the
 * Script tab numbers beats (a `## BEAT: 8 · …` header, else its place). Null
 * when the script has no beats, or no beat that opens the closet: then no
 * beat is named anywhere ("Beat 8 needs it" was written into the pages).
 */
const CLOSET_CANON = Number(Object.keys(EXPECTED_ON_SCREEN).find((n) => EXPECTED_ON_SCREEN[n].action === 'CLOSET_OPEN'));
export function closetBeat(scriptText) {
  const script = String(scriptText || '');
  if (!/##\s*BEAT:/i.test(script)) return null;
  const sections = script.split(/(?=##\s*BEAT:)/i).filter((s) => /^\s*##\s*BEAT:/i.test(s));
  const beats = sections.map((section, i) => {
    const [header, ...lines] = section.split('\n');
    const label = (header.match(/##\s*BEAT:\s*(.+)/i)?.[1] || '').trim();
    const numbered = Number((label.match(/^(\d{1,2})\b/) || [])[1]);
    return { number: numbered >= 1 && numbered <= 14 ? numbered : i + 1, lines };
  });
  const opens = beats.find((b) => b.lines.some((l) => {
    const m = parseMoment(l);
    return m && m.verb === 'OPEN' && normKey(m.target).startsWith('closet');
  }));
  if (opens) return opens.number;
  return beats.some((b) => b.number === CLOSET_CANON) ? CLOSET_CANON : null;
}
