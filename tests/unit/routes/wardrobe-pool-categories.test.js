/**
 * For This Event guarantees a wearable dress (or top and bottom) and shoes,
 * reading categories the way the styling game does (Evoni, 2026-10-05: a
 * show whose shoes were all "Heels" was offered no wearable shoes, though
 * Full Closet listed them under Shoes).
 */
const { gameCategory, ensureReachableRequiredSlots } = require('../../../src/routes/wardrobe');

describe('the pool reads categories as the game does', () => {
  test.each([
    ['Heels', 'shoes'], ['ankle boots', 'shoes'], ['Pumps', 'shoes'], ['shoes', 'shoes'],
    ['Evening Gown', 'dress'], ['dress', 'dress'], ['Blouse', 'top'], ['Pencil Skirt', 'bottom'],
    ['bag', null], ['', null], [null, null],
  ])('%p is %p', (raw, cat) => { expect(gameCategory(raw)).toBe(cat); });

  test('wearable "Heels" and a "Gown" are offered when the pool has none', () => {
    const pool = [{ id: 'locked-shoe', clothing_category: 'shoes', can_select: false }];
    const scored = [
      { id: 'heels', clothing_category: 'Heels', can_select: true, match_score: 5 },
      { id: 'gown', clothing_category: 'Evening Gown', can_select: true, match_score: 7 },
    ];
    const added = [];
    ensureReachableRequiredSlots(pool, scored, (item, role) => { added.push([item.id, role]); pool.push(item); });
    expect(added.map(([id]) => id).sort()).toEqual(['gown', 'heels']);
  });

  test('a pool that already has wearable heels adds no shoes', () => {
    const pool = [{ id: 'heels', clothing_category: 'Heels', can_select: true }, { id: 'd', clothing_category: 'dress', can_select: true }];
    const scored = [{ id: 'boots', clothing_category: 'boots', can_select: true, match_score: 9 }];
    const added = [];
    ensureReachableRequiredSlots(pool, scored, (item) => added.push(item.id));
    expect(added).toEqual([]);
  });
});
