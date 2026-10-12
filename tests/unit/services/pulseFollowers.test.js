/**
 * The follower ledger's estimates (Task #2952): parseApprox reads
 * follower_count_approx, and estimateStart falls back to the tier's middle.
 */
const { parseApprox, estimateStart, TIER_MIDDLE } = require('../../../src/services/pulseFollowers');

describe('parseApprox', () => {
  test.each([
    ['47k', 47000],
    ['1.2M', 1200000],
    ['~3,400 followers', 3400],
    ['2b', 2000000000],
    ['  850 ', 850],
  ])('%s → %d', (text, n) => expect(parseApprox(text)).toBe(n));

  test.each([[null], [undefined], [''], ['lots'], ['0'], [47000]])('%p → null', (text) => expect(parseApprox(text)).toBeNull());
});

describe('estimateStart', () => {
  test('the estimate first, saying where it came from', () => {
    expect(estimateStart({ follower_count_approx: '47k', follower_tier: 'mega' })).toEqual({ count: 47000, from: 'estimate "47k"' });
  });

  test('else the middle of the tier', () => {
    expect(estimateStart({ follower_count_approx: 'unknown', follower_tier: 'mid' })).toEqual({ count: TIER_MIDDLE.mid, from: 'the middle of the mid tier' });
  });

  test('else nothing', () => {
    expect(estimateStart({ follower_count_approx: null, follower_tier: null })).toBeNull();
    expect(estimateStart(null)).toBeNull();
  });
});
