'use strict';

/**
 * A character's facts (Character Consistency Engine step 2; Evoni,
 * 2026-10-16): one value per fact, checked when set.
 */
const { formatCount, affordabilityOf, nextCanonFacts, FactsError } = require('../../../src/services/characterFacts');

describe('formatCount', () => {
  test.each([[2000000, '2M'], [1200000, '1.2M'], [47000, '47k'], [3400, '3,400'], [0, '0'], [1500000000, '1.5B']])('%s → %s', (n, out) => {
    expect(formatCount(n)).toBe(out);
  });
});

describe('affordability comes from income', () => {
  test('a yearly or monthly amount picks the tier', () => {
    expect(affordabilityOf({ amount: 20000, cadence: 'per_year' })).toEqual({ key: 'struggling', label: 'Struggling', yearly: 20000 });
    expect(affordabilityOf({ amount: 10000, cadence: 'per_month' })).toMatchObject({ key: 'comfortable', yearly: 120000 });
    expect(affordabilityOf({ amount: 2000000, cadence: 'per_year' })).toMatchObject({ key: 'wealthy' });
  });
  test('no amount or no cadence: nothing to work out', () => {
    expect(affordabilityOf(null)).toBeNull();
    expect(affordabilityOf({ amount: 5000 })).toBeNull();
  });
});

describe('nextCanonFacts', () => {
  test('keeps what the body does not touch and cleans what it does', () => {
    const out = nextCanonFacts({ occupation: 'Stylist', undecided: [] }, {
      income: { amount: '85000', cadence: 'per_year', source: '  brand deals  ' },
      major_possessions: [' a vintage Range Rover ', '', 'a loft in Echo Park'],
      undecided: ['income', 'income', 'nonsense'],
    });
    expect(out).toEqual({
      occupation: 'Stylist',
      income: { amount: 85000, cadence: 'per_year', source: 'brand deals' },
      major_possessions: ['a vintage Range Rover', 'a loft in Echo Park'],
      undecided: ['income'],
    });
  });
  test('refuses bad values', () => {
    expect(() => nextCanonFacts({}, { income: { amount: -5 } })).toThrow(FactsError);
    expect(() => nextCanonFacts({}, { income: { amount: 5, cadence: 'per_week' } })).toThrow(/per month or per year/);
    expect(() => nextCanonFacts({}, { major_possessions: 'a car' })).toThrow(/list/);
  });
});
