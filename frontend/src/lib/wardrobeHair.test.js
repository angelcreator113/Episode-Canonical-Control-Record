/**
 * Hair in the closet and the styling game (Task 3167; Evoni, 2026-10-14):
 * the hairstyle or wig, worn one at a time; hair bows and clips stay
 * accessories. The Add Piece picker offers it, the shopping list has its line.
 */
import { test, expect } from 'vitest';
import { SLOT_KEYS, SLOT_SUBCATEGORIES, getSlotForCategory, groupItemsBySlot } from './wardrobeSlots';
import { GAME_SLOT_DEFS, MULTI_SLOTS, gameSlotFor, closetGroupFor, equipInto, backdropFor } from './closetGrouping';
import { lineOfPiece } from './eventDocuments';

test('the shared slots: Hair is a sixth, and every slot has its Add Piece choices', () => {
  expect(SLOT_KEYS).toEqual(['outfit', 'shoes', 'jewelry', 'accessories', 'hair', 'fragrance']);
  for (const slot of SLOT_KEYS) expect(Array.isArray(SLOT_SUBCATEGORIES[slot]) && SLOT_SUBCATEGORIES[slot].length > 0).toBe(true);
  expect(SLOT_SUBCATEGORIES.hair).toEqual([{ value: 'hair', label: '💇 Hair (hairstyle, wig)' }]);
  expect(SLOT_SUBCATEGORIES.accessories.map((o) => o.label)).toContain('🎀 Accessory (hair bow, scarf, belt)');
  expect(Object.keys(groupItemsBySlot([{ clothing_category: 'wig' }]))).toContain('hair');
  expect(groupItemsBySlot([{ clothing_category: 'wig' }]).hair).toHaveLength(1);
});

test('hairstyles and wigs are Hair; bows, clips and headbands stay accessories, in both readers', () => {
  for (const c of ['hair', 'Wig', 'hairstyle', 'curly lace wig']) {
    expect([c, getSlotForCategory(c), gameSlotFor(c)]).toEqual([c, 'hair', 'hair']);
  }
  for (const c of ['hair bow', 'velvet hair bow', 'Hair Clips', 'headband', 'gold hairpin']) {
    expect([c, getSlotForCategory(c), gameSlotFor(c)]).toEqual([c, 'accessories', 'accessories']);
  }
  expect(['Mini Skirt', 'Dress Shoes', 'Evening Dress'].map(gameSlotFor)).toEqual(['bottom', 'shoes', 'body']);
});

test('in the game, Hair is one piece at a time: a new one replaces the last', () => {
  expect(GAME_SLOT_DEFS.find((s) => s.key === 'hair')).toMatchObject({ label: 'Hair', required: false, categories: ['hair'] });
  expect(MULTI_SLOTS.has('hair')).toBe(false);
  const waves = { id: 'w1', clothing_category: 'wig' };
  const bob = { id: 'w2', clothing_category: 'hair' };
  expect(equipInto(equipInto({}, waves), bob)).toEqual({ hair: bob });
  expect(closetGroupFor('wig')).toBe('hair');
  expect(backdropFor({ clothing_category: 'wig' })).toBe('hair');
});

test("a Hair piece ticks the shopping list's Hair line; a bow ticks Accessories", () => {
  expect(lineOfPiece({ category: 'wig' })).toBe('hair');
  expect(lineOfPiece({ clothing_category: 'hair' })).toBe('hair');
  expect(lineOfPiece({ category: 'hair bow' })).toBe('accessories');
});
