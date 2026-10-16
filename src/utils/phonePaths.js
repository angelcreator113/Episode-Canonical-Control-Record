'use strict';

/**
 * Phone paths, on the server (Evoni, 2026-10-16: the Script tab flagged
 * "messages_page is on Homepage, but the phone shows closet" in beat after
 * beat). A tap only works on the screen its icon sits on; the writer tapped
 * Homepage icons from wherever the last beat left the phone.
 *
 * - phoneMapContext: the phone's map for the writer's prompt (each screen's
 *   icons and what they open, where the phone starts);
 * - scriptWithPhonePaths: after the writer, a `[UI:OPEN <screen>]` step
 *   before each tap the phone can't make from where it is.
 *
 * The phone walk (parseMoment … phoneCheck) is
 * frontend/src/lib/scriptMoments.js's, word for word, and the repair is
 * frontend/src/lib/phonePaths.js's, so the server and the Script tab read a
 * phone the same way (frontend/src/lib/phonePaths.test.js checks they agree).
 *
 * Pure; no I/O.
 */

const { normalizeBeatHeaders } = require('./beatLabelNumber');

// ── From frontend/src/lib/scriptMoments.js (keep in step) ────────────────────
const UI_LINE = /^\s*\[UI:\s*([A-Za-z_]+)\s*(.*?)\s*\]\s*$/i;

function parseMoment(line) {
  const m = String(line || '').match(UI_LINE);
  if (!m) return null;
  return { verb: m[1].toUpperCase(), target: m[2] };
}

const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const PHONE_NAMES = new Set(['phone', 'thephone', 'lalasphone', 'lalaphone', 'phonedevice']);

const PHONE_NAME = "Lala's phone";

const DEVICE_ON = new Set(['SHOW', 'DISPLAY', 'OPEN']);

const GENERIC = new Set(['overlay', 'letter', 'panel', 'window', 'screen', 'icon', 'items', 'item', 'category', 'app']);

function targetStem(target) {
  const words = String(target || '').replace(/\s+x\d+$/i, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const kept = words.filter((w) => !GENERIC.has(w.toLowerCase()));
  return normKey((kept.length ? kept : words).join(''));
}

const sharedStart = (a, b) => { let n = 0; while (n < a.length && a[n] === b[n]) n += 1; return n; };

function resolveMoment(moment, on = {}) {
  const { screens = [], overlays = [], icons = [] } = on;
  if (!moment) return null;
  // A notification, a DM or a post (Task #2885) names no screen: it is what
  // the phone shows, with who and the words from the line itself.
  const message = messageOf(moment);
  if (message) return message;
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

const MESSAGE_VERBS = { NOTIFY: 'notify', DM: 'dm', POST: 'post' };

function messageOf(moment) {
  const kind = MESSAGE_VERBS[String(moment?.verb || '').toUpperCase()];
  if (!kind) return null;
  const target = String(moment.target || '').trim();
  // `[UI:DM : words]` has no sender, so a colon in the words stays in them.
  const at = kind === 'post' ? -1 : target.indexOf(':');
  const who = at > 0 ? target.slice(0, at).trim() : null;
  const text = (at >= 0 ? target.slice(at + 1) : target).trim();
  const name = kind === 'post' ? 'Lala posts' : kind === 'dm' ? `DM${who ? ` with ${who}` : ''}` : `Notification${who ? ` from ${who}` : ''}`;
  return { kind, name, who, text, url: null };
}

function phoneIcons(screens = [], iconArt = []) {
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

function momentLine(verb, target) {
  return `[UI:${String(verb || 'OPEN').toUpperCase()} ${String(target || '').trim()}]`;
}

function phoneCheck(lines = [], on = {}, { startAt = null } = {}) {
  const screens = on.screens || [];
  const byId = new Map(screens.map((s) => [s.id, s]));
  const home = screens.find((s) => s.is_home) || null;
  const nameOf = (id) => byId.get(id)?.name || id || 'the phone';
  let at = startAt || home?.id || null;
  const trail = [];
  const go = (id) => { if (at && at !== id) trail.push(at); at = id; };
  const taps = [];
  const missing = [];
  let moments = 0;
  lines.forEach((line, i) => {
    const moment = parseMoment(line);
    if (!moment) return;
    moments += 1;
    const shown = resolveMoment(moment, on);
    const target = String(moment.target || '').replace(/\s+x\d+$/i, '').trim();
    if (TAP_VERBS.has(moment.verb)) {
      if (shown?.kind !== 'icon') { missing.push({ i, name: target }); return; }
      const icon = (on.icons || []).find((ic) => ic.name === shown.name) || null;
      const everywhere = icon?.onName === 'Every screen';
      const ok = !icon || everywhere || !at || icon.on === at;
      taps.push({ i, name: shown.name, ok, why: ok ? null : `${shown.name} is on ${icon.onName || nameOf(icon.on)}, but the phone shows ${nameOf(at)}`, on: icon?.on || null, onName: icon?.onName || null });
      if (icon?.opens) go(icon.opens);
      return;
    }
    if (!shown) { if (!OFF_VERBS.has(moment.verb)) missing.push({ i, name: target }); return; }
    if (shown.kind === 'device') { if (!DEVICE_ON.has(moment.verb)) { at = home?.id || null; trail.length = 0; } return; }
    if (shown.kind === 'phone') {
      const screen = screens.find((s) => (s.name || s.id) === shown.name);
      if (!screen) return;
      if (!OFF_VERBS.has(moment.verb)) go(screen.id);
      else if (screen.id === at) at = trail.pop() || home?.id || null;
      return;
    }
    if (shown.kind === 'overlay' && !shown.url && !OFF_VERBS.has(moment.verb)) missing.push({ i, name: shown.name });
  });
  return { moments, taps, missing, endAt: at };
}
// ── From frontend/src/lib/scriptBeatOrder.js (keep in step) ─────────────────
const BEAT_SPLIT = /(?=^[ \t]*##[ \t]*BEAT:)/im;
const HEADER_START = /^\s*##\s*BEAT:/i;
function splitSections(scriptText) {
  const parts = normalizeBeatHeaders(scriptText || '').split(BEAT_SPLIT);
  const preamble = parts.length && !HEADER_START.test(parts[0]) ? parts.shift().trimEnd() : '';
  return { preamble, sections: parts.filter((p) => HEADER_START.test(p)).map((p) => p.trimEnd()) };
}
function join({ preamble, sections }) {
  const body = sections.join('\n\n');
  return preamble ? `${preamble}\n\n${body}` : body;
}

// ── From frontend/src/lib/phonePaths.js (keep in step) ───────────────────────
const everywhere = (t) => t.onName === 'Every screen';

/** One beat's lines with the steps its taps need: { lines, added: [{ at, screen }], endAt }. */
function beatWithPhonePaths(lines = [], on = {}, { startAt = null } = {}) {
  let cur = lines.slice();
  const added = [];
  const tried = new Set();
  for (let guard = 0; guard < 100; guard += 1) {
    const check = phoneCheck(cur, on, { startAt });
    const bad = check.taps.find((t) => !t.ok && t.onName && !everywhere(t) && !tried.has(`${t.i}:${t.onName}`));
    if (!bad) return { lines: cur, added, endAt: check.endAt };
    const step = momentLine('OPEN', bad.onName);
    const next = [...cur.slice(0, bad.i), step, ...cur.slice(bad.i)];
    const after = phoneCheck(next, on, { startAt }).taps.find((t) => t.i === bad.i + 1);
    if (after?.ok) { cur = next; added.push({ at: bad.i, screen: bad.onName }); }
    else tried.add(`${bad.i}:${bad.onName}`);
  }
  return { lines: cur, added, endAt: phoneCheck(cur, on, { startAt }).endAt };
}

/**
 * The script with every tap's phone step added, beat by beat, each beat
 * starting where the one before left the phone. `skip`: beat positions
 * never changed (approved beats), read for where they leave the phone.
 * Returns { script, added }.
 */
function scriptWithPhonePaths(scriptText, on = {}, { only = null, skip = [] } = {}) {
  const split = splitSections(scriptText);
  const sections = split.sections.slice();
  let at = null;
  let added = 0;
  sections.forEach((section, beatIndex) => {
    const [header, ...rest] = section.split('\n');
    const lines = rest.filter((l) => l.trim());
    const change = !skip.includes(beatIndex) && (only === null || only.includes(beatIndex));
    if (!change) { at = phoneCheck(lines, on, { startAt: at }).endAt; return; }
    const fixed = beatWithPhonePaths(lines, on, { startAt: at });
    if (fixed.added.length) sections[beatIndex] = [header, ...fixed.lines].join('\n');
    added += fixed.added.length;
    at = fixed.endAt;
  });
  return { script: added ? join({ ...split, sections }) : scriptText, added };
}

// ── The phone as the writer reads it ─────────────────────────────────────────
// `overlays` is the show's overlay list as GET /ui-overlays/:showId gives it
// (services/phoneOverlays.js). Screens are the phone's own; icons are the
// tap zones on them (phoneIcons).
const isIcon = (o) => o?.category === 'phone_icon' || o?.category === 'icon';
const isProduction = (o) => o?.category === 'production';
const isScreen = (o) => !!o && !isIcon(o) && !isProduction(o);

/** { screens, icons, overlays: [] } for the phone walk, from the show's overlay list. */
function phoneFromOverlays(overlays = []) {
  const all = (Array.isArray(overlays) ? overlays : []).filter((o) => o && o.id);
  const screens = all.filter(isScreen);
  return { screens, icons: phoneIcons(screens, all.filter(isIcon)), overlays: [] };
}

/**
 * The PHONE MAP block for the writer: where the phone starts, each screen's
 * icons and the screen each opens, and how to move between them. '' when the
 * phone has no home screen or no icons.
 */
function phoneMapContext(on = {}) {
  const screens = on.screens || [];
  const icons = on.icons || [];
  const home = screens.find((s) => s.is_home);
  if (!home || !icons.length) return '';
  const nameOf = (id) => (screens.find((s) => s.id === id) || {}).name || id;
  const every = icons.filter((i) => i.onName === 'Every screen');
  const byScreen = new Map();
  for (const i of icons) {
    if (i.onName === 'Every screen' || !i.on) continue;
    if (!byScreen.has(i.on)) byScreen.set(i.on, []);
    byScreen.get(i.on).push(i);
  }
  const tap = (i) => `${i.name}${i.opensName ? ` → ${i.opensName}` : ''}`;
  const rows = [...byScreen.entries()]
    .sort(([a], [b]) => (a === home.id ? -1 : b === home.id ? 1 : 0))
    .map(([id, list]) => `${nameOf(id)}${id === home.id ? ' (home screen)' : ''}: ${list.map(tap).join(', ')}`);
  return `\n═══ PHONE MAP ═══
The phone starts each episode on ${home.name || home.id}. A tap works only on the screen its icon is on:
${rows.join('\n')}
${every.length ? `On every screen: ${every.map(tap).join(', ')}\n` : ''}Each beat starts where the beat before left the phone. Before tapping an icon on another screen, go there first with its own line, [UI:OPEN ${home.name || home.id}] for the home screen. [UI:CLOSE <screen>] goes back to the screen before it.
`;
}

module.exports = {
  parseMoment, resolveMoment, phoneIcons, phoneCheck, momentLine,
  beatWithPhonePaths, scriptWithPhonePaths, phoneFromOverlays, phoneMapContext,
};
