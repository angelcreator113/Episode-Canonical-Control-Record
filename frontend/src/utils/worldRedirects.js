/**
 * World-building routes that were duplicate editors (audit IA-04,
 * 2026-10-03; docs/BRAIN_OWNERSHIP.md R4; docs/WORLD_ROUTE_OWNERSHIP.md).
 * Each older page edited the same store as a Sidebar page, with its own,
 * different defaults, so the two could show different values for the same
 * thing. Each route now opens its owner's page on the tab that holds the
 * same work; the copies are deleted.
 */
export const WORLD_REDIRECTS = {
  // Legends, society and the calendar's social rules live in Social Systems.
  '/influencer-systems': '/social-systems?tab=archetypes',
  // Cities, universities, corporations: World Foundation's map; locations
  // (the /world/locations records) its Locations tab.
  '/world-infrastructure': '/world-foundation?tab=map',
  '/world-locations': '/world-foundation?tab=locations',
  // The cultural calendar is Culture & Events' Events tab; cultural memory
  // its History tab.
  '/cultural-calendar': '/culture-events?tab=events',
  '/cultural-memory': '/culture-events?tab=history',
};

/**
 * A page's opening tab from ?tab=, when it names one of the page's tabs;
 * else the page's own first choice. Read once, at mount.
 */
export function tabFromSearch(tabs, fallback, search = typeof window !== 'undefined' ? window.location.search : '') {
  const wanted = new URLSearchParams(search).get('tab');
  return tabs.some((t) => t.key === wanted) ? wanted : fallback;
}
