/** One rule for the look's cost (Evoni, 2026-10-07): lib/lookCharge mirrors episodeLookCharges.lookCharges. */
import { describe, test, expect } from 'vitest';
import { pieceCharge, lookTotal, pieceChargeText } from './lookCharge';

describe('lookCharge', () => {
  test('gifted and borrowed are free, a rental costs its rental price, owned is free, else coin_cost or price', () => {
    expect(pieceCharge({ acquisition_type: 'gifted', coin_cost: 300 })).toEqual({ amount: 0, kind: null, free: 'gifted' });
    expect(pieceCharge({ acquisition_type: 'borrowed', coin_cost: 300 }).free).toBe('borrowed');
    expect(pieceCharge({ acquisition_type: 'rented', rental_price: 75, coin_cost: 900 })).toEqual({ amount: 75, kind: 'rent', free: null });
    expect(pieceCharge({ is_owned: true, coin_cost: 180 }).free).toBe('owned');
    expect(pieceCharge({ is_owned: false, coin_cost: 420 })).toEqual({ amount: 420, kind: 'buy', free: null });
    expect(pieceCharge({ is_owned: false, price: 60 }).amount).toBe(60);
  });

  test("the server's charge wins (it knows earlier purchases)", () => {
    expect(pieceCharge({ is_owned: false, coin_cost: 420, charge: null, free_because: 'bought' })).toEqual({ amount: 0, kind: null, free: 'bought' });
    expect(pieceCharge({ coin_cost: 900, charge: { category: 'wardrobe_rental', amount: 75 } })).toEqual({ amount: 75, kind: 'rent', free: null });
  });

  test('a look totals its charges; each piece reads in words', () => {
    const look = [{ is_owned: false, coin_cost: 420 }, { is_owned: true, coin_cost: 180 }, { acquisition_type: 'gifted', coin_cost: 300 }, { acquisition_type: 'rented', rental_price: 75 }];
    expect(lookTotal(look)).toBe(495);
    expect(look.map(pieceChargeText)).toEqual(['to buy · 420 coins', 'owned', 'gifted', 'rented · 75 coins']);
  });
});
