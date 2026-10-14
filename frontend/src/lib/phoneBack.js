/**
 * Where the phone's Back goes with no screen to go back to (Task #3165;
 * Evoni, 2026-10-14: her Closet keeps its own icons, each opening its
 * section page, and Back returns to Closet). That happens when a page was
 * opened by a link from elsewhere, or a play-through resumed on it.
 *
 * The page's parent is the screen whose icon opens it: a screen other than
 * the home with a tap zone placed from an icon (by key or image) that
 * targets this page, e.g. Closet's shoe icon for the Shoes page. With none,
 * or only the home, Back goes home. History, when there is some, always
 * wins: this is only for an empty one.
 */
import { getScreenLinks, isScreen, resolveZoneIconKey } from './overlayUtils';

/** The screen Back opens from `screen` with no history: its parent, else `home`. */
export function backTargetOf(screen, screens = [], icons = [], home = null) {
  if (!screen || (home && screen.id === home.id)) return null;
  const parent = (screens || []).find((s) => isScreen(s)
    && s.id !== screen.id
    && (!home || s.id !== home.id)
    && getScreenLinks(s).some((z) => z?.target === screen.id && resolveZoneIconKey(z, icons)));
  return parent || home;
}
