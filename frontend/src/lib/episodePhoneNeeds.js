/**
 * What an episode needs from Lala's phone (phone round step 2; Evoni,
 * 2026-10-25): the screens its script's phone lines name, beat by beat, and
 * whether each is ready to play.
 *
 * The script is read the way the Script tab reads it: `## BEAT:` headers
 * (numbered by their label, else their place), each `[UI:VERB target]` line
 * a moment resolved against the episode's phone (lib/scriptMoments
 * resolveMoment), the phone's path walked beat to beat (phoneStartScreens,
 * phoneCheck), and the cutscene, beats 11-13, left out because it has no
 * phone. Nothing here writes; lib/episodePhoneBuild does the making.
 */
import { normalizeBeatHeaders, BEAT_SPLIT, HAS_BEAT_HEADER, headerNumber } from './beatLabelNumber';
import { parseMoment, resolveMoment, phoneCheck, phoneStartScreens, phoneIcons, MESSAGE_VERBS, normKey } from './scriptMoments';
import { isCutsceneBeat } from './scriptShowRules';
import { isScreen, isIcon, isProduction } from './overlayUtils';

const BEAT_HEADER_START = /^\s*##\s*BEAT:/i;
const BEAT_COUNT = 14;

/**
 * The script's beats, [{ number, lines }], as the Script tab's
 * parseScriptIntoBeats numbers them: a headed beat by its label's number,
 * else its place; a script with no header split into up to 14 beats by place.
 */
export function scriptBeats(text) {
  const script = normalizeBeatHeaders(text || '');
  if (!script.trim()) return [];
  if (HAS_BEAT_HEADER.test(script)) {
    return script.split(BEAT_SPLIT).filter((s) => BEAT_HEADER_START.test(s)).map((section, i) => {
      const lines = section.split('\n').filter((l) => l.trim());
      const label = (lines[0]?.match(/##\s*BEAT:\s*(.+)/i)?.[1] || '').trim();
      return { number: headerNumber(label) || i + 1, lines: lines.slice(1) };
    });
  }
  const lines = script.split('\n').filter((l) => l.trim());
  const per = Math.max(1, Math.ceil(lines.length / BEAT_COUNT));
  const beats = [];
  for (let i = 0; i < BEAT_COUNT && i * per < lines.length; i += 1) beats.push({ number: i + 1, lines: lines.slice(i * per, (i + 1) * per) });
  return beats;
}

/** The phone as the Script tab hands it to scriptMoments: its screens, the icons on them, and the show's production overlays. */
export function phoneOnScreen(overlays = []) {
  const all = (overlays || []).filter((o) => o && o.id);
  const screens = all.filter(isScreen);
  const production = all.filter(isProduction).map((o) => ({ key: o.id, label: o.name || o.id, image_url: o.url || null }));
  return { screens, icons: phoneIcons(screens, all.filter(isIcon)), overlays: production, production };
}

/** A content zone that draws nothing yet: it has a kind but no settings. */
export const isEmptyZone = (z) => Boolean(z && z.content_type && (!z.content_config || typeof z.content_config !== 'object' || Object.keys(z.content_config).length === 0));
export const emptyZones = (screen) => (Array.isArray(screen?.content_zones) ? screen.content_zones.filter(isEmptyZone) : []);

// The words the generators add to a target ("InviteLetterOverlay"), left out of the name a new screen gets.
const GENERIC = new Set(['overlay', 'letter', 'panel', 'window', 'screen', 'icon', 'app', 'page']);
/** The name a screen the script names but the phone lacks is made with: "InvitationScreen" is "Invitation". */
export function screenNameFor(target) {
  const words = String(target || '').replace(/\s+x\d+$/i, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const kept = words.filter((w) => !GENERIC.has(w.toLowerCase()));
  return (kept.length ? kept : words).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const OFF_VERBS = new Set(['HIDE', 'REMOVE', 'CLOSE']);
const TAP_VERBS = new Set(['CLICK', 'TAP', 'SELECT']);
// The Start button brings the phone up (lib/scriptMoments isStartButton): it is not a screen.
const isStartButton = (m) => /^start(button)?$/.test(normKey(m?.target));

// How each status reads on the card, in the order Build all fixes them.
export const NEED_STATUS = {
  missing: 'Missing',
  unmade: 'Missing: no picture yet',
  unreachable: 'Exists but no tap zone to reach it',
  empty: 'Content zone empty',
  ok: 'Exists',
};

/**
 * The screens the script needs and the path problems on the way:
 * { hasScript, moments, needs: [{ key, name, screen, beats, status, issues,
 * from, emptyZones }], problems: [{ beat, text }] }.
 *
 * A need is one screen: `screen` the phone's (null when the phone has none
 * by that name), `beats` the beat numbers that use it, `issues` every
 * status that applies (status is the first, 'ok' with none), `from` the
 * screen the phone shows just before the script first opens it (the one a
 * tap zone to it goes on; home when unknown). A tap opens the screen its
 * icon opens; the Start button is not a screen. Problems are the taps that
 * are not a real path (phoneCheck's "X is on Mail, but the phone shows
 * Home"), taps on something that is not an icon, and icons that open no screen.
 */
export function phoneNeeds(scriptText, overlays = []) {
  const beats = scriptBeats(scriptText);
  const on = phoneOnScreen(overlays);
  const home = on.screens.find((s) => s.is_home) || null;
  const byId = new Map(on.screens.map((s) => [s.id, s]));
  const reachable = new Set(on.icons.map((i) => i.opens).filter((id) => byId.has(id)));
  if (home) reachable.add(home.id);
  const needs = new Map();
  const problems = [];
  let moments = 0;
  const starts = phoneStartScreens(beats, on);

  const need = (key, name, screen, beat, from) => {
    if (!needs.has(key)) needs.set(key, { key, name, screen, beats: [], from: from || home?.id || null });
    const n = needs.get(key);
    if (!n.beats.includes(beat)) n.beats.push(beat);
  };

  beats.forEach((b, bi) => {
    if (isCutsceneBeat(b.number)) return;
    const startAt = starts[bi] || null;
    const check = phoneCheck(b.lines, on, { startAt });
    for (const t of check.taps) if (!t.ok && t.why) problems.push({ beat: b.number, text: t.why });
    b.lines.forEach((line, i) => {
      const m = parseMoment(line);
      if (!m || MESSAGE_VERBS[m.verb] || isStartButton(m)) return;
      const shown = resolveMoment(m, on);
      if (shown?.kind === 'device' || shown?.kind === 'overlay') return;
      moments += 1;
      // Where the phone is just before this line: a tap zone to the screen goes there.
      const before = () => phoneCheck(b.lines.slice(0, i), on, { startAt }).endAt;
      if (shown?.kind === 'icon') {
        // resolveMoment names the screen an icon opens; the icon holds its id.
        const icon = on.icons.find((ic) => ic.name === shown.name && ic.opensName === shown.opens);
        const opens = icon?.opens ? byId.get(icon.opens) : null;
        if (opens) need(opens.id, opens.name || opens.id, opens, b.number, before());
        else if (!problems.some((p) => p.beat === b.number && p.text.startsWith(`${shown.name} opens`))) problems.push({ beat: b.number, text: `${shown.name} opens no screen` });
        return;
      }
      if (shown?.kind === 'phone') {
        const screen = on.screens.find((s) => (s.name || s.id) === shown.name);
        if (screen && !OFF_VERBS.has(m.verb)) need(screen.id, screen.name || screen.id, screen, b.number, before());
        return;
      }
      if (OFF_VERBS.has(m.verb)) return;
      // A tap on something the phone has no icon or screen for names an
      // icon, not a screen to make: it is a path problem, as the Script tab reads it.
      if (TAP_VERBS.has(m.verb)) {
        problems.push({ beat: b.number, text: `${String(m.target || '').trim()} is not an icon on the phone` });
        return;
      }
      const name = screenNameFor(m.target);
      if (!name) return;
      need(`new:${normKey(name)}`, name, null, b.number, before());
    });
  });

  const list = [...needs.values()].map((n) => {
    const s = n.screen;
    const issues = [];
    if (!s) issues.push('missing');
    else if (!s.generated || !s.url) issues.push('unmade');
    if (s && !reachable.has(s.id)) issues.push('unreachable');
    const zones = emptyZones(s);
    if (zones.length) issues.push('empty');
    // A tap zone never goes on the screen it opens.
    const from = n.from && n.from !== s?.id ? n.from : (home && home.id !== s?.id ? home.id : null);
    return { ...n, from, fromScreen: from ? byId.get(from) || null : null, issues, status: issues[0] || 'ok', emptyZones: zones };
  });
  return { hasScript: beats.length > 0, moments, needs: list, problems };
}

/** "beat 5" or "beats 5 and 8" or "beats 2, 5 and 8". */
export function beatsLabel(beats = []) {
  if (!beats.length) return '';
  if (beats.length === 1) return `beat ${beats[0]}`;
  return `beats ${beats.slice(0, -1).join(', ')} and ${beats[beats.length - 1]}`;
}

/**
 * The steps Build all takes, in its order: make each missing screen, then a
 * tap zone to each screen nothing reaches, then each empty content zone.
 * `calls` is what it may spend: a picture per screen made, a tap-zone
 * proposal per screen to reach (a screen just made counts, since nothing
 * reaches it yet), and a fill per empty zone.
 */
export function buildPlan(needs = []) {
  const make = needs.filter((n) => n.issues.includes('missing') || n.issues.includes('unmade'));
  const reach = needs.filter((n) => n.issues.includes('unreachable') || n.issues.includes('missing'));
  const fill = needs.flatMap((n) => n.emptyZones.map((z) => ({ need: n, zone: z })));
  const calls = { pictures: make.length, zones: reach.length, fills: fill.length };
  return { make, reach, fill, calls, total: calls.pictures + calls.zones + calls.fills };
}
