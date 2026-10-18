/**
 * Paging for long lists (Evoni, 2026-10-18, the character page redesign:
 * "pagination is super important": long lists show a page at a time with
 * page controls, not one long scroll).
 *
 *   pageCount(total, size)           how many pages; at least 1
 *   clampPage(page, total, size)     the page kept in range when the list shrinks
 *   pageSlice(items, page, size)     the items on that page
 *   pageRange(page, total, size)     { from, to } (1-based), for "6–10 of 23"
 *   pageButtons(page, pages)         the page numbers to show, with 'gap' between
 *                                    runs: 1 … 4 5 6 … 12
 */

export const DEFAULT_PAGE_SIZE = 5;

export const pageCount = (total, size = DEFAULT_PAGE_SIZE) => Math.max(1, Math.ceil((Number(total) || 0) / size));

export const clampPage = (page, total, size = DEFAULT_PAGE_SIZE) => Math.min(Math.max(1, page), pageCount(total, size));

export function pageSlice(items, page, size = DEFAULT_PAGE_SIZE) {
  const list = Array.isArray(items) ? items : [];
  const p = clampPage(page, list.length, size);
  return list.slice((p - 1) * size, p * size);
}

export function pageRange(page, total, size = DEFAULT_PAGE_SIZE) {
  if (!total) return { from: 0, to: 0 };
  const p = clampPage(page, total, size);
  return { from: (p - 1) * size + 1, to: Math.min(p * size, total) };
}

export function pageButtons(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => keep.add(n));
  const nums = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}
