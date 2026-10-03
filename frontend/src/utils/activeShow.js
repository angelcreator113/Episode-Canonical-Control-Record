/**
 * The show Evoni is working on, shared by the Sidebar, Producer Mode, the
 * show page and the standalone Phone Hub / UI Overlays pages, so every entry
 * point lands on the same show instead of "the first show the API returned".
 *
 * Order: the show in the URL (/shows/:id/...), else the show last opened
 * (remembered in this browser), else the only show. With several shows and
 * nothing to go on, null: the caller asks Evoni to choose.
 */
const KEY = 'primeStudios.activeShowId';

export function rememberShow(id) {
  if (!id) return;
  try {
    window.localStorage.setItem(KEY, String(id));
  } catch (err) {
    console.error('[activeShow] could not remember the show:', err);
  }
}

export function rememberedShowId() {
  try {
    return window.localStorage.getItem(KEY);
  } catch (err) {
    console.error('[activeShow] could not read the remembered show:', err);
    return null;
  }
}

/** The show id in a /shows/:id/... path, or null (/shows, /shows/create). */
export function showIdFromPath(pathname) {
  const m = /^\/shows\/([^/?#]+)/.exec(pathname || '');
  return m && m[1] !== 'create' ? decodeURIComponent(m[1]) : null;
}

/** The active show's id among shows ([{ id }]), or null when it has to be chosen. */
export function activeShowId({ pathname = '', shows = [] } = {}) {
  const ids = new Set((shows || []).map((s) => String(s.id)));
  const fromPath = showIdFromPath(pathname);
  if (fromPath && ids.has(fromPath)) return fromPath;
  const remembered = rememberedShowId();
  if (remembered && ids.has(remembered)) return remembered;
  if (ids.size === 1) return [...ids][0];
  return null;
}
