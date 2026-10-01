/**
 * Event spending (the event cost split ruling, Evoni 2026-09-30;
 * docs/EVENT_EPISODE_FLOW.md §8(cc)): the line rules.
 */
const {
  readSpendingBody, spendingDraftState, chargeableSpending, EXTRAS_LINES, SPENDING_CATEGORY,
} = require('../../../src/services/episodeSpendingService');
const { draftedCostLines } = require('../../../src/services/eventCostsService');

describe('readSpendingBody', () => {
  test('a new line needs a label and a unit price; quantity defaults to 1', () => {
    expect(readSpendingBody({ label: ' Drinks ', unit_price: 40 }, { partial: false }))
      .toEqual({ fields: { label: 'Drinks', quantity: 1, unit_price: 40 } });
    expect(readSpendingBody({ unit_price: 40 }, { partial: false }).error).toMatch(/label is required/);
    expect(readSpendingBody({ label: 'Drinks' }, { partial: false }).error).toMatch(/unit_price/);
  });

  test('quantity is a whole number from 1 to 999; unit price a whole number, 0 or more', () => {
    for (const quantity of [0, 1000, 1.5, 'two']) {
      expect(readSpendingBody({ quantity }, { partial: true }).error).toMatch(/quantity/);
    }
    for (const unitPrice of [-1, 2.5, '', null]) {
      expect(readSpendingBody({ unit_price: unitPrice }, { partial: true }).error).toMatch(/unit_price/);
    }
    expect(readSpendingBody({ quantity: 999, unit_price: 0 }, { partial: true }))
      .toEqual({ fields: { quantity: 999, unit_price: 0 } });
  });

  test('an edit sends any subset; a long label is refused', () => {
    expect(readSpendingBody({}, { partial: true })).toEqual({ fields: {} });
    expect(readSpendingBody({ label: 'x'.repeat(201) }, { partial: true }).error).toMatch(/at most 200/);
  });
});

describe('spendingDraftState (doctrine rule 14)', () => {
  test('Auto-drafted while it equals the drafted copy, then Edited; a hand line has none', () => {
    const drafted = { quantity: 1, unit_price: 100, drafted_quantity: 1, drafted_unit_price: 100 };
    expect(spendingDraftState(drafted)).toBe('auto_drafted');
    expect(spendingDraftState({ ...drafted, quantity: 2 })).toBe('edited');
    expect(spendingDraftState({ ...drafted, unit_price: 90 })).toBe('edited');
    expect(spendingDraftState({ quantity: 1, unit_price: 5, drafted_quantity: null, drafted_unit_price: null })).toBeNull();
  });
});

describe('chargeableSpending', () => {
  test('quantity × unit price, lines above 0 only', () => {
    const lines = chargeableSpending([
      { id: 'a', quantity: 3, unit_price: 25 },
      { id: 'b', quantity: 2, unit_price: 0 },
    ]);
    expect(lines.map((l) => [l.id, l.total])).toEqual([['a', 75]]);
    expect(SPENDING_CATEGORY).toBe('event_spending');
  });
});

describe('the split: extras are spending, not terms costs', () => {
  test('the drafted extras are drinks, valet and photo booth', () => {
    expect(EXTRAS_LINES.map((l) => l.key)).toEqual(['drinks', 'valet', 'photo_booth']);
  });

  test('the terms draft no longer adds extras: a paid appearance drafts nothing, self-funded only its entry', () => {
    const gala = { cost_coins: 100, prestige: 8, format: 'gala' };
    expect(draftedCostLines({ ...gala, deal_type: 'paid_appearance' })).toEqual([]);
    expect(draftedCostLines({ ...gala, deal_type: 'self_funded' }).map((l) => l.kind)).toEqual(['entry']);
  });
});
