/**
 * wardrobeReach — the frontend mirror of src/services/wardrobeReach.js
 * (Task #1937). The same cases as tests/unit/services/wardrobeReach.test.js.
 */
import { describe, test, expect } from 'vitest';
import { itemReach, withReach, lockReason, setCost } from './wardrobeReach';

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
  ['no price is free', { is_owned: false, lock_type: 'none' }, {}, true, true],
  ['reputation lock is bought, not earned', { is_owned: false, lock_type: 'reputation', reputation_required: 3, coin_cost: 200 }, { coins: 100, reputation: 9 }, false, false],
  ['reputation lock, affordable at reputation 0', { is_owned: false, lock_type: 'reputation', reputation_required: 3, coin_cost: 200 }, { coins: 200 }, true, true],
  ['unknown lock type is for sale', { is_owned: false, lock_type: 'dream_fund', coin_cost: 10 }, { coins: 10 }, true, true],
  ['brand exclusive', { is_owned: false, lock_type: 'brand_exclusive', coin_cost: 1 }, { coins: 9999, reputation: 10 }, false, false],
  ['season drop', { is_owned: false, lock_type: 'season_drop', coin_cost: 1 }, { coins: 9999, reputation: 10 }, false, false],
];

describe('itemReach (frontend)', () => {
  test.each(CASES)('%s', (label, item, character, canSelect, canPurchase) => {
    const r = itemReach(item, character);
    expect(r.can_select).toBe(canSelect);
    expect(r.can_purchase).toBe(canPurchase);
  });

  test('withReach keeps the item and sets the two flags', () => {
    const out = withReach({ id: 'w1', name: 'Gown', is_owned: false, lock_type: 'coin', coin_cost: 10 }, { coins: 20 });
    expect(out).toMatchObject({ id: 'w1', name: 'Gown', can_select: true, can_purchase: true });
  });
});

describe('lockReason and setCost (Evoni, 2026-10-06)', () => {
  test('lockReason names what stands in the way', () => {
    expect(lockReason({ is_owned: false, lock_type: 'brand_exclusive' }, { coins: 9999 })).toBe('Brand exclusive · not for sale');
    expect(lockReason({ is_owned: false, lock_type: 'season_drop', season_unlock_episode: 9 }, {})).toBe('Drops Ep 9 · not for sale');
    expect(lockReason({ is_owned: false, lock_type: 'none', coin_cost: 400 }, { coins: 100 })).toBe('Need 400 coins');
    expect(lockReason({ is_owned: false, lock_type: 'reputation', coin_cost: 50 }, { coins: 100 })).toBeNull();
    expect(lockReason({ is_owned: true, lock_type: 'brand_exclusive' }, {})).toBeNull();
  });

  test('setCost adds the pieces Lala can buy and lists the ones not for sale', () => {
    const pieces = [
      { id: 'a', is_owned: true, coin_cost: 500 },
      { id: 'b', is_owned: false, lock_type: 'none', coin_cost: 120 },
      { id: 'c', is_owned: null, lock_type: 'coin', coin_cost: 80 },
      { id: 'd', is_owned: false, lock_type: 'season_drop', coin_cost: 10 },
    ];
    const r = setCost(pieces);
    expect(r.cost).toBe(200);
    expect(r.toBuy.map((p) => p.id)).toEqual(['b', 'c']);
    expect(r.notForSale.map((p) => p.id)).toEqual(['d']);
  });
});
