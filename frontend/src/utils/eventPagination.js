/**
 * Producer Mode → Events pagination (Task #2360, Evoni's redesign of 2026-09-30).
 *
 * The queue shows EVENTS_PER_PAGE cards per page. Filters, search and sort
 * run first; this only slices the finished list. The page lives in the URL
 * as `?evpage=N` so it survives a refresh.
 */

export const EVENTS_PER_PAGE = 9;
export const EVENT_PAGE_PARAM = 'evpage';

/** A page number from the URL: a positive integer, else 1. */
export function parseEventPage(raw) {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Slice a list to one page. A page past the end (say, after a delete or a
 * narrower filter) clamps to the last page.
 */
export function paginateEvents(list, requestedPage, perPage = EVENTS_PER_PAGE) {
  const items = list || [];
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(Math.max(1, requestedPage || 1), totalPages);
  const start = (page - 1) * perPage;
  return { page, totalPages, pageItems: items.slice(start, start + perPage) };
}

/**
 * The page numbers to show. Up to 7 pages, every page; past that, the first,
 * the last, and the current page with its neighbours, with 'gap' markers.
 */
export function eventPageNumbers(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const keep = new Set([1, totalPages, page - 1, page, page + 1]);
  const out = [];
  for (let n = 1; n <= totalPages; n += 1) {
    if (keep.has(n)) out.push(n);
    else if (out[out.length - 1] !== 'gap') out.push('gap');
  }
  return out;
}

/**
 * The Events queue's search, filters and sort live in the URL with the page
 * (the audit's "Pagination and totals are inconsistent": filter on the last
 * page, delete its last event, go Back, refresh, and the queue is where it
 * was). Defaults are left out of the URL.
 */
export const EVENT_QUERY_PARAMS = Object.freeze({ search: 'evq', state: 'evstate', deal: 'evdeal', sort: 'evsort' });
const EVENT_QUERY_DEFAULTS = Object.freeze({ search: '', state: 'all', deal: 'all', sort: 'name' });
export const EVENT_SORTS = ['name', 'prestige', 'cost', 'status', 'created'];

/** { search, state, deal, sort } from the URL, each with its default. */
export function readEventQuery(params) {
  const get = (k) => params?.get?.(EVENT_QUERY_PARAMS[k]) ?? null;
  const sort = get('sort');
  return {
    search: get('search') ?? EVENT_QUERY_DEFAULTS.search,
    state: get('state') || EVENT_QUERY_DEFAULTS.state,
    deal: get('deal') || EVENT_QUERY_DEFAULTS.deal,
    sort: EVENT_SORTS.includes(sort) ? sort : EVENT_QUERY_DEFAULTS.sort,
  };
}

/**
 * The next URL params after a change. A change to the search, a filter or
 * the sort sends the queue back to page 1; { page } alone moves the page.
 * One update, so a filter and its page reset never overwrite each other.
 */
export function nextEventParams(prev, patch) {
  const next = new URLSearchParams(prev);
  for (const [key, param] of Object.entries(EVENT_QUERY_PARAMS)) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value == null || value === EVENT_QUERY_DEFAULTS[key]) next.delete(param);
    else next.set(param, String(value));
  }
  const page = 'page' in patch ? patch.page : 1;
  if (page > 1) next.set(EVENT_PAGE_PARAM, String(page));
  else next.delete(EVENT_PAGE_PARAM);
  return next;
}

/** "Showing 10–18 of 214 matching · 250 events", or the whole-list form. */
export function eventRangeText({ page, perPage = EVENTS_PER_PAGE, matching, total }) {
  const all = `${total.toLocaleString()} event${total === 1 ? '' : 's'}`;
  if (matching === 0) return total ? `No events match · ${all}` : 'No events yet';
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, matching);
  const shown = from === to ? `${from}` : `${from}–${to}`;
  return matching === total ? `Showing ${shown} of ${all}` : `Showing ${shown} of ${matching.toLocaleString()} matching · ${all}`;
}
