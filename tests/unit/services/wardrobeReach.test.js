/**
 * wardrobeReach — the one reach rule for the styling game (Task #1937).
 * frontend/src/utils/wardrobeReach.test.js pins the same cases against the
 * frontend mirror, so Closet/Search and the backend agree.
 */
const { itemReach, isForSale, priceRequired, cannotBuyReason } = require('../../../src/services/wardrobeReach');

const CASES = [
  // [label, item, character, can_select, can_purchase]
  // Evoni's ruling, 2026-10-06: every unowned piece is for sale at its
  // coin_cost, except brand-exclusive and season-drop pieces.
  ['owned', { is_owned: true, lock_type: 'coin', coin_cost: 999 }, { coins: 0 }, true, false],
  ['owned brand exclusive', { is_owned: true, lock_type: 'brand_exclusive' }, { coins: 0 }, true, false],
  ['coin, affordable', { is_owned: false, lock_type: 'coin', coin_cost: 300 }, { coins: 350 }, true, true],
  ['coin, exactly affordable', { is_owned: false, lock_type: 'coin', coin_cost: 350 }, { coins: 350 }, true, true],
  ['coin, not affordable', { is_owned: false, lock_type: 'coin', coin_cost: 385 }, { coins: 350 }, false, false],
  ['no lock, affordable', { is_owned: false, lock_type: 'none', coin_cost: 120 }, { coins: 500 }, true, true],
  ['no lock, not affordable', { is_owned: false, lock_type: 'none', coin_cost: 900 }, { coins: 500 }, false, false],
  ['null lock and null ownership, affordable', { is_owned: null, lock_type: null, coin_cost: 50 }, { coins: 50 }, true, true],
  // Evoni's ruling, 2026-10-14 (Task #3143): a price is required; an
  // unowned piece with no coin_cost above 0 is not for sale until priced.
  ['no price: price required', { is_owned: false, lock_type: 'none' }, { coins: 9999 }, false, false],
  ['zero price: price required', { is_owned: false, lock_type: 'coin', coin_cost: 0 }, { coins: 9999 }, false, false],
  ['owned with no price is still wearable', { is_owned: true, lock_type: 'none' }, { coins: 0 }, true, false],
  ['reputation lock is bought, not earned', { is_owned: false, lock_type: 'reputation', reputation_required: 3, coin_cost: 200 }, { coins: 100, reputation: 9 }, false, false],
  ['reputation lock, affordable at reputation 0', { is_owned: false, lock_type: 'reputation', reputation_required: 3, coin_cost: 200 }, { coins: 200 }, true, true],
  ['unknown lock type is for sale', { is_owned: false, lock_type: 'dream_fund', coin_cost: 10 }, { coins: 10 }, true, true],
  ['brand exclusive', { is_owned: false, lock_type: 'brand_exclusive', coin_cost: 1 }, { coins: 9999, reputation: 10 }, false, false],
  ['season drop', { is_owned: false, lock_type: 'season_drop', coin_cost: 1 }, { coins: 9999, reputation: 10 }, false, false],
];

describe('itemReach (backend)', () => {
  it.each(CASES)('%s', (label, item, character, canSelect, canPurchase) => {
    const r = itemReach(item, character);
    expect(r.can_select).toBe(canSelect);
    expect(r.can_purchase).toBe(canPurchase);
  });

  it('an unowned piece for sale needs a purchase whether or not it is affordable', () => {
    expect(itemReach({ is_owned: false, lock_type: 'coin', coin_cost: 385 }, { coins: 0 })).toMatchObject({ needs_purchase: true, coin_cost: 385 });
    expect(itemReach({ is_owned: false, lock_type: 'none', coin_cost: 385 }, { coins: 0 })).toMatchObject({ needs_purchase: true, coin_cost: 385 });
    expect(itemReach({ is_owned: true, lock_type: 'coin', coin_cost: 385 }, { coins: 0 }).needs_purchase).toBe(false);
    expect(itemReach({ is_owned: false, lock_type: 'season_drop', coin_cost: 385 }, { coins: 9999 }).needs_purchase).toBe(false);
  });

  it('isForSale: unowned, priced, and not brand-exclusive or season-drop', () => {
    expect(isForSale({ is_owned: false, lock_type: 'reputation', coin_cost: 5 })).toBe(true);
    expect(isForSale({ is_owned: null, lock_type: null, coin_cost: 5 })).toBe(true);
    // Task #3143: a price is required.
    expect(isForSale({ is_owned: null, lock_type: null })).toBe(false);
    expect(isForSale({ is_owned: false, lock_type: 'none', coin_cost: 0 })).toBe(false);
    expect(isForSale({ is_owned: true, lock_type: 'coin' })).toBe(false);
    expect(isForSale({ is_owned: false, lock_type: 'brand_exclusive' })).toBe(false);
    expect(isForSale({ is_owned: false, lock_type: 'season_drop' })).toBe(false);
  });

  // Evoni's ruling, 2026-10-14 (Task #3143).
  it('price required: unowned, sellable and unpriced; the reason names it', () => {
    expect(priceRequired({ is_owned: false, lock_type: 'none' })).toBe(true);
    expect(priceRequired({ is_owned: false, lock_type: 'coin', coin_cost: 0 })).toBe(true);
    expect(priceRequired({ is_owned: false, lock_type: 'none', coin_cost: 10 })).toBe(false);
    expect(priceRequired({ is_owned: true, lock_type: 'none' })).toBe(false);
    expect(priceRequired({ is_owned: false, lock_type: 'season_drop' })).toBe(false);
    expect(itemReach({ is_owned: false, lock_type: 'none' }, { coins: 9999 })).toMatchObject({ can_select: false, needs_purchase: false, price_required: true });
    expect(cannotBuyReason({ is_owned: false, lock_type: 'none' })).toBe('price required: give it a coin price first');
    expect(cannotBuyReason({ is_owned: false, lock_type: 'season_drop' })).toBe('a season drop, not for sale');
    expect(cannotBuyReason({ is_owned: false, lock_type: 'brand_exclusive' })).toBe('brand exclusive, not for sale');
    expect(cannotBuyReason({ is_owned: false, lock_type: 'none', coin_cost: 10 })).toBeNull();
    expect(cannotBuyReason({ is_owned: true, lock_type: 'none' })).toBeNull();
  });
});
