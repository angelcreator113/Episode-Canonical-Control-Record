import { describe, test, expect, vi } from 'vitest';
import { fetchAllPages, partialNote, fetchAllEpisodes, fetchAllSceneSets } from './fetchAllPages';

const rows = (from, n) => Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }));

// A fake list API: `count` rows, paged by page/limit or offset/limit,
// with or without a total.
function pagedApi(count, { withTotal = true, ignorePaging = false } = {}) {
  return {
    get: vi.fn(async (url) => {
      const q = new URL(url, 'http://x').searchParams;
      const limit = Number(q.get('limit'));
      const offset = q.has('offset') ? Number(q.get('offset')) : (Number(q.get('page') || 1) - 1) * limit;
      const start = ignorePaging ? 0 : offset;
      const data = rows(start, Math.max(0, Math.min(limit, count - start)));
      return { data: { data, ...(withTotal ? { pagination: { total: count } } : {}) } };
    }),
  };
}

describe('fetchAllPages', () => {
  test('reads every page until the total is reached', async () => {
    const api = pagedApi(450);
    const list = await fetchAllPages(api, ({ page, limit }) => `/x?limit=${limit}&page=${page}`, { pageSize: 200 });
    expect(list.items).toHaveLength(450);
    expect(list).toMatchObject({ total: 450, complete: true });
    expect(api.get).toHaveBeenCalledTimes(3);
  });

  test('without a total, a short page ends a complete list', async () => {
    const list = await fetchAllPages(pagedApi(250, { withTotal: false }), ({ limit, offset }) => `/x?limit=${limit}&offset=${offset}`, { pageSize: 200 });
    expect(list).toMatchObject({ total: null, complete: true });
    expect(list.items).toHaveLength(250);
  });

  test('a server that ignores paging, or the page cap, leaves the list incomplete', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ignoring = await fetchAllPages(pagedApi(500, { ignorePaging: true }), ({ page, limit }) => `/x?limit=${limit}&page=${page}`, { pageSize: 200 });
    expect(ignoring).toMatchObject({ total: 500, complete: false });
    expect(ignoring.items).toHaveLength(200);
    const capped = await fetchAllPages(pagedApi(1000), ({ page, limit }) => `/x?limit=${limit}&page=${page}`, { pageSize: 100, maxPages: 3 });
    expect(capped).toMatchObject({ total: 1000, complete: false });
    expect(partialNote(capped)).toBe('Showing 300 of 1,000');
    expect(partialNote({ items: [1, 2], total: null, complete: false })).toBe('Showing the first 2');
    expect(partialNote({ items: [], total: 0, complete: true })).toBeNull();
  });

  test('episodes page by page/limit 100; scene sets by limit/offset 200', async () => {
    const eps = pagedApi(150);
    expect((await fetchAllEpisodes(eps, 'show 1')).items).toHaveLength(150);
    expect(eps.get.mock.calls.map((c) => c[0])).toEqual([
      '/api/v1/episodes?show_id=show%201&limit=100&page=1',
      '/api/v1/episodes?show_id=show%201&limit=100&page=2',
    ]);
    const sets = { get: vi.fn(async (url) => pagedApi(230).get(url).then((r) => ({ data: { data: r.data.data, total: 230 } }))) };
    const list = await fetchAllSceneSets(sets, 's1');
    expect(list).toMatchObject({ total: 230, complete: true });
    expect(sets.get.mock.calls.map((c) => c[0])).toEqual([
      '/api/v1/scene-sets?show_id=s1&limit=200&offset=0',
      '/api/v1/scene-sets?show_id=s1&limit=200&offset=200',
    ]);
  });
});
