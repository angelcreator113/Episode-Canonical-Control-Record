/**
 * recommendLooks — whole outfits from the closet's per-piece event match
 * (Evoni, 2026-10-03, episode creation step 3).
 */
import { describe, test, expect } from 'vitest';
import { recommendLooks, baseCategory } from './recommendLooks';

const piece = (id, clothing_category, event_match, extra = {}) => ({
  id, name: id, clothing_category, event_match, is_owned: true, coin_cost: 0, ...extra,
});

const CLOSET = [
  piece('lavender-midi', 'dress', 92),
  piece('floral-corset', 'Evening Dress', 87),
  piece('silk-blouse', 'blouse', 70),
  piece('cream-skirt', 'skirt', 75),
  piece('gold-sandals', 'sandals', 90),
  piece('nude-heels', 'heels', 85),
  piece('gold-hoops', 'earrings', 88),
  piece('cream-bag', 'clutch', 80),
  piece('rose-scent', 'perfume', 60),
];

describe('baseCategory', () => {
  test('resolves canonical names, aliases and free text', () => {
    expect(baseCategory('dress')).toBe('dress');
    expect(baseCategory('Evening Dress')).toBe('dress');
    expect(baseCategory('clutch')).toBe('bag');
    expect(baseCategory('ankle boots')).toBe('shoes');
    expect(baseCategory('mystery')).toBeNull();
  });
});

describe('recommendLooks', () => {
  test('three looks, each from a different outfit, best match first, every slot filled', () => {
    const looks = recommendLooks(CLOSET);
    expect(looks.map((l) => l.label)).toEqual(['Look A', 'Look B', 'Look C']);
    expect(looks[0].pieces.map((p) => p.id)).toEqual(['lavender-midi', 'gold-sandals', 'gold-hoops', 'cream-bag', 'rose-scent']);
    expect(looks[0].match).toBe(Math.round((92 + 90 + 88 + 80 + 60) / 5));
    expect(looks[1].pieces[0].id).toBe('floral-corset');
    // The top comes with the best bottom.
    expect(looks[2].pieces.slice(0, 2).map((p) => p.id)).toEqual(['silk-blouse', 'cream-skirt']);
    expect(looks.every((l) => l.owned && l.missing.length === 0)).toBe(true);
  });

  test('a nearly-as-good unused piece varies the look; a much worse one does not', () => {
    const looks = recommendLooks(CLOSET);
    // nude-heels (85) is within 10 of gold-sandals (90): Look B wears them.
    expect(looks[1].pieces.map((p) => p.id)).toContain('nude-heels');
    // Only one pair left unused after that, so Look C goes back to the best.
    expect(looks[2].pieces.map((p) => p.id)).toContain('gold-sandals');
  });

  test('pieces Lala owns come before better pieces she would have to buy', () => {
    const looks = recommendLooks([
      piece('shop-gown', 'gown', 99, { is_owned: false, coin_cost: 400 }),
      piece('own-dress', 'dress', 80),
      piece('own-shoes', 'shoes', 70),
    ]);
    expect(looks[0].pieces[0].id).toBe('own-dress');
    expect(looks[0].owned).toBe(true);
    expect(looks[1]).toMatchObject({ owned: false, toBuyCost: 400 });
    expect(looks[1].toBuy.map((p) => p.id)).toEqual(['shop-gown']);
  });

  test('a closet with no shoes says so; no outfit piece means no looks', () => {
    const noShoes = recommendLooks([piece('d', 'dress', 80)]);
    expect(noShoes[0].missing).toEqual(['shoes']);
    expect(recommendLooks([piece('s', 'shoes', 90)])).toEqual([]);
    expect(recommendLooks(null)).toEqual([]);
  });

  test('count limits the looks', () => {
    expect(recommendLooks(CLOSET, { count: 2 })).toHaveLength(2);
  });
});
