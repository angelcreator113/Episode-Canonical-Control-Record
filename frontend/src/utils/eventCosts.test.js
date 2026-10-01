import { describe, test, expect } from 'vitest';
import { buildCostBody, costDraftFrom, costDraftNote, costTotals, costName, costAmountLabel } from './eventCosts';

describe('eventCosts (Task #2365)', () => {
  test('buildCostBody: a whole amount, a known kind and payer; an empty label is none', () => {
    expect(buildCostBody({ kind: 'travel', label: ' Car ', amount: '80', paid_by: 'lala' }))
      .toEqual({ body: { kind: 'travel', label: 'Car', amount: 80, paid_by: 'lala' } });
    expect(buildCostBody({ kind: 'glam', label: '', amount: '0', paid_by: 'host' }).body.label).toBeNull();
    // D13 travel: an empty amount is no amount yet ("Price required"), not an error.
    expect(buildCostBody({ kind: 'travel', amount: '', paid_by: 'lala' }).body.amount).toBeNull();
    expect(buildCostBody({ kind: 'glam', amount: '2.5', paid_by: 'lala' }).error).toMatch(/whole number/);
    expect(buildCostBody({ kind: 'glam', amount: '-3', paid_by: 'lala' }).error).toMatch(/whole number/);
    expect(buildCostBody({ kind: 'limo', amount: '3', paid_by: 'lala' }).error).toMatch(/kind/);
    expect(buildCostBody({ kind: 'glam', amount: '3', paid_by: 'friend' }).error).toMatch(/pays/);
  });

  test('a new draft defaults to travel, paid by Lala', () => {
    expect(costDraftFrom(null)).toEqual({ kind: 'travel', label: '', amount: '', paid_by: 'lala' });
    expect(costDraftFrom({ kind: 'glam', label: null, amount: 60, paid_by: 'brand' }))
      .toEqual({ kind: 'glam', label: '', amount: '60', paid_by: 'brand' });
  });

  test('the rule 14 note: Auto-drafted while the amount is as drafted, then Edited', () => {
    const drafted = { c1: { key: 'drinks', amount: 100 } };
    expect(costDraftNote({ id: 'c1', amount: 100 }, drafted)).toBe('Auto-drafted · event extras');
    expect(costDraftNote({ id: 'c1', amount: 120 }, drafted)).toBe('Edited');
    expect(costDraftNote({ id: 'c2', amount: 5 }, drafted)).toBeNull();
    const entry = { e1: { key: 'entry', amount: 100, source: 'event_cost' } };
    expect(costDraftNote({ id: 'e1', amount: 100 }, entry)).toBe('Auto-drafted · from event cost');
    expect(costDraftNote({ id: 'e1', amount: 90 }, entry)).toBe('Edited');
  });

  test('totals and names', () => {
    expect(costTotals([{ amount: 80, paid_by: 'lala' }, { amount: 400, paid_by: 'host' }])).toEqual({ lala: 80, comped: 400 });
    expect(costName({ kind: 'glam', label: null })).toBe('Glam');
    expect(costName({ kind: 'glam', label: 'Hair' })).toBe('Hair');
  });

  test('D13 travel: a line with no amount reads Price required, never 0', () => {
    expect(costAmountLabel({ amount: null })).toBe('Price required');
    expect(costAmountLabel({ amount: 1200 })).toBe('1,200 coins');
    expect(costAmountLabel({ amount: 0 })).toBe('0 coins');
    const drafted = { c1: { key: 'travel', amount: null, paid_by: 'lala', source: 'travel' } };
    expect(costDraftNote({ id: 'c1', amount: null, paid_by: 'lala' }, drafted)).toBe('Auto-drafted · Lala travels');
    expect(costDraftNote({ id: 'c1', amount: 300, paid_by: 'lala' }, drafted)).toBe('Edited');
  });
});
