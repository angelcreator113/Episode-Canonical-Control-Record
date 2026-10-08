/**
 * The Phone Hub's header and phone caption (Evoni's mock, 2026-10-07): the
 * three tiles (screens ready, screens, icons) and the line under the phone
 * (its tap zones and icons). Pure: UIOverlaysTab renders.
 *
 * "Ready" is the screen cards' own rule (`screenCardStatus`, below): an
 * image, every zone with a destination, and something linking to it unless
 * it is the home screen. The old header line counted every row with an
 * image, icons included ("10/11 screens ready" with 6 screens).
 */
import { isScreen, isIcon, getScreenLinks } from './overlayUtils';

// A screen's state in plain words and its one next action (doctrine rule 18,
// Task #2042), from what the page already computes: whether the screen has an
// image, the page's screenDiagnostics for it (zone counts and zones with no
// destination) and how many zones on other screens lead here. Up to three
// lines, in the order the next action is chosen: image, links, incoming.
// `next` is 'image', 'links', 'incoming' or null (Ready).
export function screenCardStatus({ hasImage, diagnostics, isHome = false, incoming = 0 }) {
  const lines = [];
  let next = null;
  const need = (step) => { if (!next) next = step; };

  if (hasImage) lines.push({ key: 'image', text: '✓ Image', warn: false });
  else { lines.push({ key: 'image', text: '⚠ No image', warn: true }); need('image'); }

  if (hasImage && diagnostics?.counts) {
    const { tap = 0, icon = 0 } = diagnostics.counts;
    const total = tap + icon;
    const noDestination = (diagnostics.missingTarget || 0) + (diagnostics.brokenTarget || 0);
    if (noDestination > 0) {
      lines.push({ key: 'links', text: `⚠ ${noDestination} zone${noDestination === 1 ? ' has' : 's have'} no destination`, warn: true });
      need('links');
    } else if (total > 0) {
      lines.push({ key: 'links', text: `${icon} icon${icon === 1 ? '' : 's'} · ${total}/${total} linked`, warn: false });
    } else {
      lines.push({ key: 'links', text: 'No zones yet', warn: false });
    }
  }

  if (!isHome && incoming === 0) {
    lines.push({ key: 'incoming', text: '⚠ Nothing links here', warn: true });
    need('incoming');
  }

  return { ready: next === null, next, lines };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The home screen: the one marked home, else the first with an image. */
export function homeScreenOf(overlays) {
  const generated = (overlays || []).filter((s) => s.generated && s.url && isScreen(s));
  return generated.find((s) => s.is_home) || generated[0] || null;
}

/** How many zones on any screen lead to each screen, by id. */
export function incomingById(screens) {
  const reach = new Map();
  (screens || []).forEach((src) => {
    getScreenLinks(src).forEach((link) => {
      if (link?.target) reach.set(link.target, (reach.get(link.target) || 0) + 1);
    });
  });
  return reach;
}

/** The header's tiles: screens ready of all screens, screens, icons. */
export function phoneHubTiles(overlays, diagnostics) {
  const list = overlays || [];
  const screens = list.filter((o) => isScreen(o));
  const icons = list.filter(isIcon);
  const home = homeScreenOf(list);
  const reach = incomingById(screens);
  const ready = screens.filter((s) => screenCardStatus({
    hasImage: !!(s.generated && s.url),
    diagnostics: diagnostics?.get?.(s.id),
    isHome: s.id === home?.id,
    incoming: reach.get(s.id) || 0,
  }).ready).length;
  return [
    { key: 'ready', value: `${ready}/${screens.length}`, label: 'screens ready' },
    { key: 'screens', value: String(screens.length), label: screens.length === 1 ? 'screen' : 'screens' },
    { key: 'icons', value: String(icons.length), label: icons.length === 1 ? 'icon' : 'icons' },
  ];
}

/** The line under the phone: what the shown screen holds. */
export function screenCaption(screen, diagnostics) {
  if (!screen) return null;
  if (!(screen.generated && screen.url)) return 'No image yet';
  const counts = diagnostics?.get?.(screen.id)?.counts;
  const tap = counts?.tap || 0;
  const icon = counts?.icon || 0;
  if (!tap && !icon) return 'No tap zones yet';
  return [tap ? plural(tap, 'tap zone') : null, icon ? plural(icon, 'icon') : null].filter(Boolean).join(' · ');
}

/**
 * The Map stage (Evoni's mockup, 2026-10-08: "How Lala moves through her
 * phone"): every tap out of the home screen, and what the phone can't do.
 * Pure; works on the screens with an image.
 *
 *   home        the home screen, or null
 *   taps        one per home zone with a destination, in zone order:
 *               { zoneId, label, targetKey, target (screen or null),
 *                 onward (how many screens it leads on to),
 *                 state: 'onward' | 'dead' | 'missing' }
 *   deadEnds    screens Lala can reach but not leave by a tap: no zone
 *               leads anywhere and no pinned home icon shows there
 *   unreachable screens nothing leads to from home (home itself aside)
 *   openedTwice on one screen, two or more zones open the same screen:
 *               { screen, target, labels, zoneIds }
 *
 * `icons` names a zone placed from an icon ("Camera") when it has no label.
 */
export function phoneFlowMap(overlays, icons = []) {
  const list = overlays || [];
  const screens = list.filter((o) => isScreen(o) && o.generated && o.url);
  const byId = new Map(screens.map((s) => [s.id, s]));
  const home = homeScreenOf(list);
  const empty = { home: null, taps: [], deadEnds: [], unreachable: [], openedTwice: [] };
  if (!home) return empty;

  const iconName = (z) => {
    const ico = z?.icon_overlay_id && (icons || []).find((i) => i.id === z.icon_overlay_id);
    return ico ? String(ico.name || '').replace(/\s*icon$/i, '') : '';
  };
  const labelOf = (z, i) => (z?.label || '').trim() || iconName(z) || `Zone ${i + 1}`;
  const targetsOf = (s) => getScreenLinks(s).map((z) => z?.target).filter((t) => t && byId.has(t) && t !== s.id);
  // A pinned home icon shows on every other screen, so it is a way out.
  const pinnedOut = getScreenLinks(home).some((z) => z?.persistent && z?.target && byId.has(z.target));

  const taps = getScreenLinks(home)
    .map((z, i) => ({ z, i }))
    .filter(({ z }) => z?.target)
    .map(({ z, i }) => {
      const target = byId.get(z.target) || null;
      const onward = target ? new Set(targetsOf(target)).size : 0;
      const state = !target ? 'missing' : (onward > 0 || (pinnedOut && target.id !== home.id)) ? 'onward' : 'dead';
      return { zoneId: z.id, label: labelOf(z, i), targetKey: z.target, target, onward, state };
    });

  const reached = new Set([home.id]);
  const queue = [home.id];
  while (queue.length) {
    const id = queue.shift();
    targetsOf(byId.get(id)).forEach((t) => { if (!reached.has(t)) { reached.add(t); queue.push(t); } });
  }

  const deadEnds = screens.filter((s) => s.id !== home.id && reached.has(s.id) && targetsOf(s).length === 0 && !pinnedOut);
  const unreachable = screens.filter((s) => !reached.has(s.id));

  const openedTwice = [];
  screens.forEach((s) => {
    const byTarget = new Map();
    getScreenLinks(s).forEach((z, i) => {
      if (!z?.target || !byId.has(z.target)) return;
      byTarget.set(z.target, [...(byTarget.get(z.target) || []), { label: labelOf(z, i), id: z.id }]);
    });
    byTarget.forEach((zs, t) => {
      if (zs.length > 1) openedTwice.push({ screen: s, target: byId.get(t), labels: zs.map(z => z.label), zoneIds: zs.map(z => z.id) });
    });
  });

  return { home, taps, deadEnds, unreachable, openedTwice };
}
