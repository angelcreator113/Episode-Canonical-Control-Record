/**
 * Full Closet grouping and paging (Task #2377): every item lands in a group,
 * bottoms included, and unknown categories go to Other instead of vanishing.
 */
import { describe, test, expect, vi } from 'vitest';
import {
  GAME_SLOT_DEFS, OTHER_GROUP, canonicalCategory, gameSlotFor, closetGroupFor,
  groupClosetItems, fetchAllClosetItems, MULTI_SLOTS, slotPieces, outfitPieces, normalizeSlots, backdropFor } from './closetGrouping';

const ITEMS = [
  { id: 'dress', clothing_category: 'dress' },
  { id: 'top', clothing_category: 'top' },
  { id: 'bottom', clothing_category: 'bottom' },
  { id: 'shoes', clothing_category: 'shoes' },
  { id: 'accessory', clothing_category: 'accessory' },
  { id: 'bag', clothing_category: 'bag' },
  { id: 'jewelry', clothing_category: 'jewelry' },
  { id: 'perfume', clothing_category: 'perfume' },
  // variants seen in hand-entered / AI-classified data
  { id: 'bottoms', clothing_category: 'Bottoms' },
  { id: 'skirt', clothing_category: 'skirt' },
  { id: 'pants', clothing_category: 'Pants ' },
  { id: 'mini-skirt', clothing_category: 'Mini Skirt' },
  { id: 'wide-leg', clothing_category: 'wide-leg trousers' },
  { id: 'accessories', clothing_category: 'accessories' },
  { id: 'dress-shoes', clothing_category: 'Dress Shoes' },
  { id: 'ankle-boots', clothing_category: 'ankle boots' },
  { id: 'evening-dress', clothing_category: 'Evening Dress' },
  { id: 'fragrance', clothing_category: 'Fragrance' },
  // no game slot
  { id: 'outerwear', clothing_category: 'outerwear' },
  { id: 'coat', clothing_category: 'coat' },
  { id: 'unknown', clothing_category: 'costume piece' },
  { id: 'null', clothing_category: null },
  { id: 'empty', clothing_category: '' },
];

const EXPECTED = {
  body: ['dress', 'evening-dress'],
  top: ['top'],
  bottom: ['bottom', 'bottoms', 'skirt', 'pants', 'mini-skirt', 'wide-leg'],
  shoes: ['shoes', 'dress-shoes', 'ankle-boots'],
  accessories: ['accessory', 'bag', 'accessories'],
  jewelry: ['jewelry'],
  perfume: ['perfume', 'fragrance'],
  other: ['outerwear', 'coat', 'unknown', 'null', 'empty'],
};

describe('groupClosetItems', () => {
  test('every category, bottoms included, lands in its group and unknowns go to Other', () => {
    const groups = groupClosetItems(ITEMS);
    const ids = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map(i => i.id).sort()]));
    const want = Object.fromEntries(Object.entries(EXPECTED).map(([k, v]) => [k, [...v].sort()]));
    expect(ids).toEqual(want);
  });

  test('no item is dropped', () => {
    const groups = groupClosetItems(ITEMS);
    const total = Object.values(groups).reduce((n, g) => n + g.length, 0);
    expect(total).toBe(ITEMS.length);
  });

  test('has a group for every game slot plus Other', () => {
    expect(Object.keys(groupClosetItems([]))).toEqual([...GAME_SLOT_DEFS.map(s => s.key), OTHER_GROUP.key]);
  });
});

describe('category resolution', () => {
  test('canonical categories and head-noun matches', () => {
    expect(canonicalCategory('Bottoms')).toBe('bottom');
    expect(canonicalCategory('Dress Shoes')).toBe('shoes');
    expect(canonicalCategory('Evening Dress')).toBe('dress');
    expect(canonicalCategory('t-shirt')).toBe('top');
    expect(canonicalCategory('outerwear')).toBe('outerwear');
    expect(canonicalCategory(undefined)).toBe(null);
  });

  test('outerwear has no game slot but has a closet group', () => {
    expect(gameSlotFor('jacket')).toBe(null);
    expect(closetGroupFor('jacket')).toBe('other');
    expect(gameSlotFor('jeans')).toBe('bottom');
  });
});

describe('fetchAllClosetItems', () => {
  const makeApi = (total, { withPagination = true } = {}) => {
    const all = Array.from({ length: total }, (_, i) => ({ id: `w${i}`, clothing_category: 'bottom' }));
    return {
      all,
      get: vi.fn(async (url) => {
        const q = new URLSearchParams(url.split('?')[1]);
        const limit = Number(q.get('limit'));
        const page = Number(q.get('page'));
        const data = all.slice((page - 1) * limit, page * limit);
        return { data: withPagination ? { success: true, data, pagination: { page, limit, total } } : { data } };
      }),
    };
  };

  test('reads past the first page (no silent 200-item truncation)', async () => {
    const api = makeApi(450);
    const items = await fetchAllClosetItems(api, 'show-1');
    expect(items).toHaveLength(450);
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(api.get.mock.calls[0][0]).toBe('/api/v1/wardrobe?show_id=show-1&limit=200&page=1');
  });

  test('stops at a short page when the server sends no pagination', async () => {
    const api = makeApi(250, { withPagination: false });
    expect(await fetchAllClosetItems(api, 'show-1')).toHaveLength(250);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('stops when a server ignores page and repeats rows', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}` }));
    const api = { get: vi.fn(async () => ({ data: { data: rows } })) };
    expect(await fetchAllClosetItems(api, 's')).toHaveLength(200);
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

describe('several accessories and jewellery (W2)', () => {
  const a = { id: 'a' }; const b = { id: 'b' }; const d = { id: 'd' };
  test('only Accessories and Jewelry hold several pieces', () => {
    expect([...MULTI_SLOTS].sort()).toEqual(['accessories', 'jewelry']);
  });
  test('slotPieces reads one piece or several as an array', () => {
    expect(slotPieces({ jewelry: [a, b] }, 'jewelry')).toEqual([a, b]);
    expect(slotPieces({ shoes: a }, 'shoes')).toEqual([a]);
    expect(slotPieces({}, 'shoes')).toEqual([]);
  });
  test('outfitPieces lists every piece worn with its slot', () => {
    expect(outfitPieces({ body: d, jewelry: [a, b], top: undefined })).toEqual([
      { slot: 'body', item: d }, { slot: 'jewelry', item: a }, { slot: 'jewelry', item: b },
    ]);
  });
  test('normalizeSlots turns an older one-piece draft into the multi shape, and drops empties', () => {
    expect(normalizeSlots({ jewelry: a, accessories: [a, b], shoes: b, top: null, bottom: [d] }))
      .toEqual({ jewelry: [a], accessories: [a, b], shoes: b, bottom: d });
  });
});

describe('closet card backdrops', () => {
  test('a card\'s backdrop is its piece\'s slot, else other', () => {
    expect(backdropFor({ clothing_category: 'dress' })).toBe('body');
    expect(backdropFor({ clothing_category: 'Ankle Boots' })).toBe('shoes');
    expect(backdropFor({ clothing_category: 'bag' })).toBe('accessories');
    expect(backdropFor({ clothing_category: 'outerwear' })).toBe('other');
    expect(backdropFor(null)).toBe('other');
  });
});
