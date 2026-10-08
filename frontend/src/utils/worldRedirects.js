/**
 * World-building routes that were duplicate editors (audit IA-04,
 * 2026-10-03; docs/BRAIN_OWNERSHIP.md R4; docs/WORLD_ROUTE_OWNERSHIP.md).
 * Each older page edited the same store as a Sidebar page, with its own,
 * different defaults, so the two could show different values for the same
 * thing. Each route now opens its owner's page on the tab that holds the
 * same work; the copies are deleted.
 */
export const WORLD_REDIRECTS = {
  // Legends, society and the calendar's social rules live in Society.
  '/influencer-systems': '/universe?tab=society&sub=archetypes',
  // Cities, universities, corporations: the World tab's map; locations
  // (the /world/locations records) its Locations sub-tab.
  '/world-infrastructure': '/universe?tab=world&sub=map',
  '/world-locations': '/universe?tab=world&sub=locations',
  // The cultural calendar is Culture's Events sub-tab; cultural memory
  // its History sub-tab.
  '/cultural-calendar': '/universe?tab=culture&sub=events',
  '/cultural-memory': '/universe?tab=culture&sub=history',
  // World State and Tensions are the State tab's (WorldDashboard). The
  // copy these opened (WorldStateTensions) read the tension scanner's
  // pre-2026-10-04 contract: every pair nameless, Propose Scene refused.
  '/universe/world-state': '/universe?tab=state&sub=state',
  '/universe/tensions': '/universe?tab=state&sub=tensions',
};

/**
 * The LalaVerse hub (`/universe`, `UniversePage`) holds the Show Bible and
 * the world pages as tabs (2026-10-04): each former Sidebar route opens its
 * tab, and the `?tab=` it used to carry becomes the tab's `?sub=`.
 */
export const HUB_TABS = {
  '/show-bible': 'bible',
  '/world-dashboard': 'state',
  '/world-foundation': 'world',
  '/social-systems': 'society',
  '/culture-events': 'culture',
};

/** `/universe?tab=<tab>` plus `&sub=` for a legacy `?tab=` in `search`. */
export function hubTarget(tab, search = '') {
  const sub = new URLSearchParams(search).get('tab');
  return `/universe?tab=${tab}${sub ? `&sub=${encodeURIComponent(sub)}` : ''}`;
}

/**
 * A page's opening tab from ?tab= (or the query `param` named), when it
 * names one of the page's tabs; else the page's own first choice. Read
 * once, at mount. The hub's tabs read `sub`, since `tab` is the hub's.
 */
export function tabFromSearch(tabs, fallback, search = typeof window !== 'undefined' ? window.location.search : '', param = 'tab') {
  const wanted = new URLSearchParams(search).get(param);
  return tabs.some((t) => t.key === wanted) ? wanted : fallback;
}
