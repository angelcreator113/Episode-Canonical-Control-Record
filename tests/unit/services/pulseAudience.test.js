/**
 * services/pulseAudience (Task #3033; Evoni, 2026-10-12): six audience tiers
 * from the follower count, each lower bound inclusive.
 */
const { TIERS, tierFor } = require('../../../src/services/pulseAudience');

describe('tierFor', () => {
  test.each([
    [0, 'emerging'], [999, 'emerging'],
    [1000, 'nano'], [9999, 'nano'],
    [10000, 'micro'], [49999, 'micro'],
    [50000, 'mid'], [249999, 'mid'],
    [250000, 'macro'], [999999, 'macro'],
    [1000000, 'mega'], [250000000, 'mega'],
  ])('%i followers is %s', (count, key) => {
    expect(tierFor(count).key).toBe(key);
  });

  test('labels and starting counts are the ruled ones', () => {
    expect(TIERS.map((t) => [t.label, t.from])).toEqual([
      ['Emerging', 0], ['Nano', 1000], ['Micro', 10000], ['Mid-tier', 50000], ['Macro', 250000], ['Mega', 1000000],
    ]);
  });

  test('no count, no tier; a numeric string counts; a negative count is Emerging', () => {
    expect(tierFor(null)).toBeNull();
    expect(tierFor(undefined)).toBeNull();
    expect(tierFor('')).toBeNull();
    expect(tierFor('lots')).toBeNull();
    expect(tierFor('12000').label).toBe('Micro');
    expect(tierFor(-5).label).toBe('Emerging');
  });

  test('a returned tier is a copy: changing it never changes the table', () => {
    tierFor(5).label = 'changed';
    expect(TIERS[0].label).toBe('Emerging');
  });
});
