/**
 * Hair is a wardrobe slot (Task #3167; Evoni, 2026-10-14): the hairstyle or
 * wig, one at a time. Hair bows, clips and headbands stay accessories, so no
 * piece saved before moves. The shopping list has a Hair line, and the style
 * sheet's HAIR column shows the look's Hair piece when the Lookbook has no
 * hair photo.
 */
jest.mock('@anthropic-ai/sdk', () => jest.fn());
// The shopping list draws its overlay with canvas; nothing here draws.
jest.mock('canvas', () => ({ createCanvas: jest.fn(), registerFont: jest.fn(), loadImage: jest.fn() }));

const { SLOT_KEYS, SLOT_DEFS, getSlotForCategory, groupItemsBySlot } = require('../../../src/utils/wardrobeSlots');
const { listSlotOf } = require('../../../src/services/todoListService');
const { columnContent, COLUMNS } = require('../../../src/services/styleSheetService');
const { SLOT_BACKDROP } = require('../../../src/utils/wardrobeBackdrop');
const { PRICE_RANGES } = require('../../../src/utils/wardrobePriceGuide');

describe('the Hair slot', () => {
  test('a sixth slot, one piece, optional', () => {
    expect(SLOT_KEYS).toEqual(['outfit', 'shoes', 'jewelry', 'accessories', 'hair', 'fragrance']);
    expect(SLOT_DEFS.hair).toMatchObject({ label: 'Hair', required: false, multi: false, accepts: ['hair'] });
  });

  test('hairstyles and wigs are Hair; bows, clips, pins and headbands stay accessories', () => {
    for (const c of ['hair', 'Hair', 'wig', 'Wigs', 'hairstyle', 'hair style', 'hairdo', 'curly lace wig']) {
      expect([c, getSlotForCategory(c)]).toEqual([c, 'hair']);
    }
    for (const c of ['hair bow', 'velvet hair bow', 'Hair Clips', 'headband', 'gold hairpin', 'hair accessory', 'scrunchie', 'accessory']) {
      expect([c, getSlotForCategory(c)]).toEqual([c, 'accessories']);
    }
    // The rest route as before.
    expect(['evening dress', 'sundress', 'ankle boots', 't-shirt', 'perfume'].map(getSlotForCategory))
      .toEqual(['outfit', 'outfit', 'shoes', 'outfit', 'fragrance']);
  });

  test('every slot gets a group, Hair included, so a hair piece never throws', () => {
    const g = groupItemsBySlot([{ clothing_category: 'wig' }, { clothing_category: 'hair bow' }, { clothing_category: 'costume' }]);
    expect(Object.keys(g).sort()).toEqual([...SLOT_KEYS, '__unassigned'].sort());
    expect([g.hair.length, g.accessories.length, g.__unassigned.length]).toEqual([1, 1, 1]);
  });

  test('a backdrop colour and a price row for Hair', () => {
    expect(SLOT_BACKDROP.hair).toBe('#D9CFEE');
    expect(PRICE_RANGES.hair).toEqual({ basic: [30, 150], mid: [150, 600], luxury: [600, 2500], elite: [2500, 8000] });
  });
});

describe('the shopping list Hair line', () => {
  test('a hair piece ticks Hair; a hair bow still ticks Accessories', () => {
    expect(['hair', 'Wig', 'braided hairstyle'].map(listSlotOf)).toEqual(['hair', 'hair', 'hair']);
    expect(['hair bow', 'velvet hair bow', 'headband'].map(listSlotOf)).toEqual(['accessories', 'accessories', 'accessories']);
  });
});

describe("the style sheet's HAIR column", () => {
  const lb = { hair_name: 'soft glam waves', nails_name: 'nude' };
  const photo = { image_url: 'https://x/hair.jpg' };
  const wig = { name: 'Honey Lace Wig', image_url: 'https://x/wig.png' };

  test('the Lookbook hair photo wins', () => {
    expect(columnContent('hair', { lb, hairPhoto: photo, byColumn: { hair: [wig] } }))
      .toEqual({ name: 'soft glam waves', url: 'https://x/hair.jpg', source: 'Lookbook' });
  });

  test("without a photo, the look's Hair piece fills it", () => {
    expect(columnContent('hair', { lb, hairPhoto: null, byColumn: { hair: [wig] } }))
      .toEqual({ name: 'Honey Lace Wig', url: 'https://x/wig.png', source: 'saved look' });
  });

  test('with neither, the Lookbook hair name alone; nails and the piece columns unchanged', () => {
    expect(columnContent('hair', { lb, byColumn: { hair: [] } })).toEqual({ name: 'soft glam waves', url: null, source: 'Lookbook' });
    expect(columnContent('nails', { lb, byColumn: { hair: [wig] } })).toEqual({ name: 'nude', url: null, source: 'Lookbook' });
    expect(columnContent('shoes', { byColumn: { shoes: [{ name: 'Pump', image_url: 'https://x/p.png' }] } }))
      .toEqual({ name: 'Pump', url: 'https://x/p.png', source: 'saved look' });
    expect(columnContent('bag', { byColumn: {} })).toEqual({ name: null, url: null, source: 'saved look' });
    expect(COLUMNS.map((c) => c.key)).toContain('hair');
  });
});
