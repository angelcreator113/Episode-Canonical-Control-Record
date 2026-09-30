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
