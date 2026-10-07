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
