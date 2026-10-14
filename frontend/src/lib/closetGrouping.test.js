/**
 * Full Closet grouping and paging (Task #2377): every item lands in a group,
 * bottoms included, and unknown categories go to Other instead of vanishing.
 */
import { describe, test, expect, vi } from 'vitest';
import {
  GAME_SLOT_DEFS, OTHER_GROUP, canonicalCategory, gameSlotFor, closetGroupFor,
  groupClosetItems, fetchAllClosetItems, MULTI_SLOTS, slotPieces, outfitPieces, normalizeSlots, backdropFor, equipInto, planSetWear } from './closetGrouping';

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
  { id: 'outerwear', clothing_category: 'outerwear' },
  { id: 'coat', clothing_category: 'coat' },
  // Hair (Task #3167): the hairstyle or wig; hair bows and clips stay accessories.
  { id: 'hair', clothing_category: 'hair' },
  { id: 'wig', clothing_category: 'Wig' },
  { id: 'hair-bow', clothing_category: 'velvet hair bow' },
  { id: 'hair-clip', clothing_category: 'Hair Clips' },
  // no game slot
  { id: 'unknown', clothing_category: 'costume piece' },
  { id: 'null', clothing_category: null },
  { id: 'empty', clothing_category: '' },
];

const EXPECTED = {
  body: ['dress', 'evening-dress'],
  top: ['top'],
  bottom: ['bottom', 'bottoms', 'skirt', 'pants', 'mini-skirt', 'wide-leg'],
  shoes: ['shoes', 'dress-shoes', 'ankle-boots'],
  accessories: ['accessory', 'bag', 'accessories', 'hair-bow', 'hair-clip'],
  jewelry: ['jewelry'],
  hair: ['hair', 'wig'],
  perfume: ['perfume', 'fragrance'],
  outerwear: ['outerwear', 'coat'],
  other: ['unknown', 'null', 'empty'],
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

  // Evoni, 2026-10-06: a jacket over a blouse.
  test('outerwear has its own game slot', () => {
    for (const c of ['outerwear', 'jacket', 'blazer', 'coat', 'cardigan', 'Leather Jacket']) expect(gameSlotFor(c)).toBe('outerwear');
    expect(closetGroupFor('jacket')).toBe('outerwear');
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
    expect(backdropFor({ clothing_category: 'outerwear' })).toBe('outerwear');
    expect(backdropFor({ clothing_category: 'costume piece' })).toBe('other');
    expect(backdropFor(null)).toBe('other');
  });
});

// Evoni, 2026-10-06: "i cant select more than one top even though its a
// jacket and blouse".
describe('outerwear layers over the outfit', () => {
  const blouse = { id: 'b', clothing_category: 'top' };
  const trousers = { id: 'tr', clothing_category: 'bottom' };
  const jacket = { id: 'j', clothing_category: 'jacket' };
  const dress = { id: 'd', clothing_category: 'dress' };

  test('a jacket and a blouse are both worn', () => {
    const look = equipInto(equipInto(equipInto({}, blouse), trousers), jacket);
    expect(look.top.id).toBe('b');
    expect(look.bottom.id).toBe('tr');
    expect(look.outerwear.id).toBe('j');
  });

  test('a dress keeps its jacket, and a dress replacing separates keeps it too', () => {
    const look = equipInto(equipInto(equipInto({}, blouse), jacket), dress);
    expect(look.body.id).toBe('d');
    expect(look.top).toBeUndefined();
    expect(look.outerwear.id).toBe('j');
  });

  test('outerwear is one layer: a second jacket replaces the first', () => {
    const look = equipInto(equipInto({}, jacket), { id: 'coat', clothing_category: 'coat' });
    expect(look.outerwear.id).toBe('coat');
    expect(MULTI_SLOTS.has('outerwear')).toBe(false);
  });
});

// Evoni's ruling, 2026-10-14 (Task #3153): short of coins, a set is worn as
// far as Lala can, and the rest is left to buy. The read's mixes
// (docs/reads/2026-10-14-set-ownership-read.md §2): an owned top and an
// unowned skirt, with Lala at 500 coins.
describe('planSetWear', () => {
  const top = { id: 'top', name: 'Owned Top', clothing_category: 'top', is_owned: true, lock_type: 'none', coin_cost: 0 };
  const skirt = (extra) => ({ id: 'skirt', name: 'Skirt', clothing_category: 'bottom', is_owned: false, ...extra });
  const ids = (list) => list.map((p) => p.id);

  test.each([
    ['coin, affordable', { lock_type: 'coin', coin_cost: 300 }, ['top', 'skirt'], [], true],
    ['coin, unaffordable', { lock_type: 'coin', coin_cost: 900 }, ['top'], ['skirt'], false],
    ['none priced, affordable', { lock_type: 'none', coin_cost: 300 }, ['top', 'skirt'], [], true],
    ['none priced, unaffordable', { lock_type: 'none', coin_cost: 900 }, ['top'], ['skirt'], false],
    ['unknown lock, priced', { lock_type: 'dream_fund', coin_cost: 300 }, ['top', 'skirt'], [], true],
  ])('owned + %s', (_label, extra, wear, leftToBuy, whole) => {
    const plan = planSetWear([top, skirt(extra)], 500);
    expect(ids(plan.wear)).toEqual(wear);
    expect(ids(plan.leftToBuy)).toEqual(leftToBuy);
    expect(plan.whole).toBe(whole);
  });

  test('unpriced and not-for-sale pieces are left out with their reason, not left to buy', () => {
    const unpriced = planSetWear([top, skirt({ lock_type: 'none', coin_cost: 0 })], 500);
    expect(ids(unpriced.wear)).toEqual(['top']);
    expect(ids(unpriced.priceRequired)).toEqual(['skirt']);
    expect(unpriced.whole).toBe(true);
    const exclusive = planSetWear([top, skirt({ lock_type: 'brand_exclusive', coin_cost: 300 })], 500);
    expect(ids(exclusive.notForSale)).toEqual(['skirt']);
    expect(ids(exclusive.wear)).toEqual(['top']);
  });

  test('buys the body first, then the cheapest, while they fit; the cost and what is left are counted', () => {
    const dress = { id: 'dress', clothing_category: 'dress', is_owned: false, lock_type: 'coin', coin_cost: 400 };
    const shoes = { id: 'shoes', clothing_category: 'shoes', is_owned: false, lock_type: 'coin', coin_cost: 80 };
    const bag = { id: 'bag', clothing_category: 'bag', is_owned: false, lock_type: 'coin', coin_cost: 50 };
    const plan = planSetWear([shoes, bag, dress], 500);
    expect(ids(plan.buy)).toEqual(['dress', 'bag']);
    expect(plan.cost).toBe(450);
    expect(ids(plan.leftToBuy)).toEqual(['shoes']);
    expect(plan.leftToBuyCost).toBe(80);
    expect(ids(plan.wear)[0]).toBe('dress');
  });

  test('a piece with no game slot is left out, never bought', () => {
    const scarf = { id: 'scarf', clothing_category: 'umbrella', is_owned: false, lock_type: 'coin', coin_cost: 10 };
    const plan = planSetWear([top, scarf], 500);
    expect(ids(plan.noSlot)).toEqual(['scarf']);
    expect(plan.buy).toEqual([]);
  });
});
