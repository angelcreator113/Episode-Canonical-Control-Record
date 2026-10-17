'use strict';

/**
 * Fact history, the pure part: which facts changed between two facts
 * objects. Followers are left to their own ledger.
 */
const { factDiff } = require('../../../src/services/factHistory');

describe('factDiff', () => {
  const before = { handle: '@maren', account_status: 'rising', occupation: 'Creator', income: { amount: 50000, cadence: 'per_year', source: null, label: 'x' }, major_possessions: ['A loft'], undecided: ['income'], followers: { count: 1 } };

  test('nothing changed: no entries (labels and followers do not count)', () => {
    expect(factDiff(before, { ...before, income: { ...before.income, label: 'y' }, followers: { count: 2 } })).toEqual([]);
  });

  test('each changed fact once, with what it was and what it became', () => {
    const after = { ...before, occupation: 'Creator and reseller', income: null, major_possessions: ['A loft', 'A Vespa'], undecided: [] };
    expect(factDiff(before, after)).toEqual([
      { key: 'income', from: { amount: 50000, cadence: 'per_year', source: null }, to: null },
      { key: 'occupation', from: 'Creator', to: 'Creator and reseller' },
      { key: 'major_possessions', from: ['A loft'], to: ['A loft', 'A Vespa'] },
      { key: 'undecided', from: ['income'], to: null },
    ]);
  });
});
