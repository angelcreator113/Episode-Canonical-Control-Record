/**
 * Itemised event costs, the pure rules (deal build PR 4, Task #2365;
 * docs/DEAL_DESIGN.md §5): the cost body, which rows Finalize charges, the
 * totals, the extras a deal drafts, the paid/free rule for a deal event,
 * and the Money tab's expected lines.
 */
const {
  isDealEvent, readCostBody, chargeableCosts, costTotals, EXTRAS_LINES, draftedCostLines,
} = require('../../../src/services/eventCostsService');
const { eventExtrasFor, wantsPhotoBooth } = require('../../../src/utils/financialRates');
const { normalizePaidFreeFlags } = require('../../../src/utils/paidFreeFlags');
const { expectedLines } = require('../../../src/services/episodeMoneyService');

describe('eventCostsService (Task #2365)', () => {
  test('a deal event is one with a deal type', () => {
    expect(isDealEvent({ deal_type: 'gifted' })).toBe(true);
    expect(isDealEvent({ deal_type: null })).toBe(false);
    expect(isDealEvent(null)).toBe(false);
  });

  test('readCostBody: POST needs a kind and a whole amount; paid_by defaults later to lala', () => {
    expect(readCostBody({ kind: 'travel', label: '  Car  ', amount: 80 }, { partial: false }))
      .toEqual({ fields: { kind: 'travel', label: 'Car', amount: 80 } });
    expect(readCostBody({ kind: 'travel' }, { partial: false }).error).toMatch(/amount/);
    expect(readCostBody({ amount: 5 }, { partial: false }).error).toMatch(/kind/);
    expect(readCostBody({ kind: 'limo', amount: 5 }, { partial: false }).error).toMatch(/kind/);
    expect(readCostBody({ kind: 'glam', amount: -1 }, { partial: false }).error).toMatch(/amount/);
    expect(readCostBody({ kind: 'glam', amount: '12' }, { partial: false })).toEqual({ fields: { kind: 'glam', amount: 12 } });
    expect(readCostBody({ kind: 'glam', amount: 1, paid_by: 'friend' }, { partial: false }).error).toMatch(/paid_by/);
    expect(readCostBody({ kind: 'glam', amount: 1, label: 'x'.repeat(201) }, { partial: false }).error).toMatch(/label/);
  });

  test('readCostBody: PUT takes any subset; an empty label reads as none', () => {
    expect(readCostBody({ paid_by: 'brand' }, { partial: true })).toEqual({ fields: { paid_by: 'brand' } });
    expect(readCostBody({ label: '   ' }, { partial: true })).toEqual({ fields: { label: null } });
    expect(readCostBody({}, { partial: true })).toEqual({ fields: {} });
  });

  test('Finalize charges only rows Lala pays with an amount; comped rows are totalled apart', () => {
    const costs = [
      { id: 'a', paid_by: 'lala', amount: 80 },
      { id: 'b', paid_by: 'host', amount: 400 },
      { id: 'c', paid_by: 'brand', amount: 90 },
      { id: 'd', paid_by: 'lala', amount: 0 },
    ];
    expect(chargeableCosts(costs).map((c) => c.id)).toEqual(['a']);
    expect(costTotals(costs)).toEqual({ lala: 80, comped: 490 });
  });

  test('the drafted extras are the finalize extras, by prestige and the photo-booth rule', () => {
    expect(EXTRAS_LINES.map((l) => l.key)).toEqual(['drinks', 'valet', 'photo_booth']);
    expect(eventExtrasFor({ prestige: 8, format: 'gala' })).toEqual({ drinks: 100, valet: 55, photo_booth: 150 });
    expect(eventExtrasFor({ prestige: 2 })).toEqual({ drinks: 0, valet: 0, photo_booth: 0 });
    expect(wantsPhotoBooth({ dress_code: 'Red carpet glam' })).toBe(true);
    expect(wantsPhotoBooth({ event_type: 'brand_deal' })).toBe(true);
    expect(wantsPhotoBooth({ format: 'brunch' })).toBe(false);
  });

  test('a deal event is never charged cost_coins; a legacy event still is', () => {
    expect(normalizePaidFreeFlags({ deal_type: 'self_funded', cost_coins: 100 })).toMatchObject({ isDeal: true, eventCost: 0 });
    expect(normalizePaidFreeFlags({ cost_coins: 100 })).toMatchObject({ isDeal: false, eventCost: 100 });
    expect(normalizePaidFreeFlags({ cost_coins: 100, is_paid: true, payment_amount: 50 }))
      .toMatchObject({ eventCost: 0, eventPayment: 50 });
  });

  test('the Money tab expects a deal event\'s Lala-paid rows, not its cost_coins', () => {
    const deal = { deal_type: 'self_funded', cost_coins: 100 };
    const costs = [
      { kind: 'travel', label: 'Car', amount: 80, paid_by: 'lala' },
      { kind: 'glam', label: null, amount: 60, paid_by: 'lala' },
      { kind: 'accommodation', label: 'Hotel', amount: 400, paid_by: 'host' },
    ];
    expect(expectedLines(deal, costs)).toEqual([
      { kind: 'expense', label: 'Car', amount: 80, source: 'terms' },
      { kind: 'expense', label: 'glam', amount: 60, source: 'terms' },
    ]);
    expect(expectedLines({ cost_coins: 100 })).toEqual([
      { kind: 'expense', label: 'Entry cost', amount: 100, source: 'terms' },
    ]);
  });

  test('answer 2: the entry line, from cost_coins, for self-funded (Lala) and invited/comped (host) deals only', () => {
    const base = { cost_coins: 120, prestige: 2 };
    expect(draftedCostLines({ ...base, deal_type: 'self_funded' })).toEqual([
      { key: 'entry', kind: 'entry', label: 'Entry / ticket', amount: 120, paid_by: 'lala', source: 'event_cost' },
    ]);
    expect(draftedCostLines({ ...base, deal_type: 'invited_comped' })[0]).toMatchObject({ paid_by: 'host', amount: 120 });
    for (const dealType of ['paid_appearance', 'gifted', 'brand_partnership']) {
      expect(draftedCostLines({ ...base, deal_type: dealType })).toEqual([]);
    }
    expect(draftedCostLines({ cost_coins: 0, prestige: 2, deal_type: 'self_funded' })).toEqual([]);
    expect(draftedCostLines({ cost_coins: 50, prestige: 8, format: 'gala', deal_type: 'self_funded' }).map((l) => l.key))
      .toEqual(['entry']); // the extras are event spending since the split (2026-09-30)
  });
});
