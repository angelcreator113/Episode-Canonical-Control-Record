/**
 * wardrobeReach — the frontend mirror of src/services/wardrobeReach.js
 * (Task #1937). The same cases as tests/unit/services/wardrobeReach.test.js.
 */
import { describe, test, expect } from 'vitest';
import { itemReach, withReach } from './wardrobeReach';

const CASES = [
  // [label, item, character, can_select, can_purchase]
  ['owned', { is_owned: true, lock_type: 'coin', coin_cost: 999 }, { coins: 0 }, true, false],
  ['null ownership is not owned', { is_owned: null, lock_type: 'none' }, { coins: 500 }, false, false],
  ['coin, affordable', { is_owned: false, lock_type: 'coin', coin_cost: 300 }, { coins: 350 }, true, true],
  ['coin, exactly affordable', { is_owned: false, lock_type: 'coin', coin_cost: 350 }, { coins: 350 }, true, true],
  ['coin, not affordable', { is_owned: false, lock_type: 'coin', coin_cost: 385 }, { coins: 350 }, false, false],
  ['reputation, qualified', { is_owned: false, lock_type: 'reputation', reputation_required: 3 }, { reputation: 3 }, true, false],
  ['reputation, not qualified', { is_owned: false, lock_type: 'reputation', reputation_required: 4 }, { reputation: 3 }, false, false],
  ['reputation 0 is 0', { is_owned: false, lock_type: 'reputation', reputation_required: 1 }, { reputation: 0 }, false, false],
  ['missing reputation is 0', { is_owned: false, lock_type: 'reputation', reputation_required: 1 }, {}, false, false],
  ['reputation-0 item at reputation 0', { is_owned: false, lock_type: 'reputation', reputation_required: 0 }, {}, true, false],
  ['brand exclusive', { is_owned: false, lock_type: 'brand_exclusive' }, { coins: 9999, reputation: 10 }, false, false],
  ['season drop', { is_owned: false, lock_type: 'season_drop' }, { coins: 9999, reputation: 10 }, false, false],
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
