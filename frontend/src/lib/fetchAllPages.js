/**
 * Lists stop silently cutting off (the Styling Adventures audit: "Pagination
 * and totals are inconsistent"). A single `limit=100` or `limit=200`
 * request showed the first page as if it were the whole list, with a count
 * to match. fetchAllPages reads page after page until the server's total is
 * reached or a page comes back short, and says whether the list is
 * complete, so a page can show "Showing X of Y" instead of a partial count.
 *
 *   fetchAllPages(api, ({ page, limit, offset }) => url, options)
 *     → { items, total, complete }
 *
 * total: the server's count when it gives one, else null. complete: every
 * row was read (the total reached, or a short or empty page with no total).
 * A list stopped by maxPages, a server that ignores paging, or a total the
 * rows never reach is not complete.
 */

const rowsOfDefault = (body) => {
  const rows = body?.data || body?.items || body?.episodes || (Array.isArray(body) ? body : null);
  return Array.isArray(rows) ? rows : [];
};

const totalOfDefault = (body) => {
  const total = Number(body?.pagination?.total ?? body?.total);
  return Number.isFinite(total) ? total : null;
};

export async function fetchAllPages(api, urlFor, {
  pageSize = 200,
  maxPages = 100,
  rowsOf = rowsOfDefault,
  totalOf = totalOfDefault,
  label = 'list',
} = {}) {
  const items = [];
  const seen = new Set();
  let total = null;
  let complete = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await api.get(urlFor({ page, limit: pageSize, offset: (page - 1) * pageSize }));
    const body = res?.data;
    const rows = rowsOf(body);
    const pageTotal = totalOf(body);
    if (pageTotal != null) total = pageTotal;
    let added = 0;
    for (const row of rows) {
      const key = row?.id ?? `__${items.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(row);
      added += 1;
    }
    if (total != null && items.length >= total) { complete = true; break; }
    if (rows.length < pageSize) { complete = total == null; break; }
    // A full page of rows already seen: the server is not paging.
    if (added === 0) break;
    if (page === maxPages) console.warn(`[${label}] stopped after ${maxPages} pages (${items.length} rows); the list may be incomplete`);
  }
  if (!complete && total != null) {
    console.warn(`[${label}] loaded ${items.length} of ${total}; the list is incomplete`);
  }
  return { items, total, complete };
}

/** "Showing 180 of 214" when a list is short of its total, else null. */
export function partialNote({ items, total, complete }) {
  if (complete) return null;
  const n = (items || []).length;
  return total != null ? `Showing ${n.toLocaleString()} of ${total.toLocaleString()}` : `Showing the first ${n.toLocaleString()}`;
}

/** Every episode of the show (GET /api/v1/episodes pages with page/limit). */
export function fetchAllEpisodes(api, showId, options = {}) {
  return fetchAllPages(api, ({ page, limit }) => `/api/v1/episodes?show_id=${encodeURIComponent(showId)}&limit=${limit}&page=${page}`,
    { pageSize: 100, label: 'episodes', ...options });
}

/**
 * Every scene set the show sees, its own and the shared ones (GET
 * /api/v1/scene-sets pages with limit/offset, at most 500 a page, and sends
 * `total` when a limit is given).
 */
export function fetchAllSceneSets(api, showId, options = {}) {
  return fetchAllPages(api, ({ limit, offset }) => `/api/v1/scene-sets?show_id=${encodeURIComponent(showId)}&limit=${limit}&offset=${offset}`,
    { pageSize: 200, label: 'scene sets', ...options });
}
