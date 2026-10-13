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

  test("each stored tier's middle lands in its matching count tier (Task #3068)", () => {
    const { tierFor } = require('../../../src/services/pulseAudience');
    expect(Object.fromEntries(Object.entries(TIER_MIDDLE).map(([stored, count]) => [stored, tierFor(count).key])))
      .toEqual({ micro: 'micro', mid: 'mid', macro: 'macro', mega: 'mega' });
    expect(estimateStart({ follower_count_approx: null, follower_tier: 'micro' })).toEqual({ count: 25000, from: 'the middle of the micro tier' });
  });

  test('else nothing', () => {
    expect(estimateStart({ follower_count_approx: null, follower_tier: null })).toBeNull();
    expect(estimateStart(null)).toBeNull();
  });
});

describe('episodeChangeFrom (Task #2956)', () => {
  const { episodeChangeFrom, EPISODE_TIER_RATE, POST_LIKES_TO_FOLLOWERS } = require('../../../src/services/pulseFollowers');

  test('a share of followers by the result, growing with the score, plus a share of the posts\' likes', () => {
    expect(episodeChangeFrom({ followers: 100000, tier: 'slay', score: 100, post_likes: 50000 }))
      .toEqual({ change: 6250 + 1000, from_result: 100000 * EPISODE_TIER_RATE.slay * 1.25, from_posts: 50000 * POST_LIKES_TO_FOLLOWERS });
    expect(episodeChangeFrom({ followers: 100000, tier: 'pass', score: 70, post_likes: 0 }).from_result).toBe(Math.round(100000 * 0.025 * 1.1));
    expect(episodeChangeFrom({ followers: 100000, tier: 'safe', score: 50, post_likes: 0 }).from_result).toBe(1000);
  });

  test('a fail loses followers, never below 0', () => {
    expect(episodeChangeFrom({ followers: 100000, tier: 'fail', score: 20, post_likes: 0 }).change).toBe(-850);
    expect(episodeChangeFrom({ followers: 10, tier: 'fail', score: 0, post_likes: 0 }).change).toBe(0);
    expect(episodeChangeFrom({ followers: 0, tier: 'fail', score: 0, post_likes: 0 }).change).toBe(0);
  });

  test('no followers yet: only the posts count; an unknown tier adds nothing from the result', () => {
    expect(episodeChangeFrom({ followers: 0, tier: 'slay', score: 90, post_likes: 5000 })).toEqual({ change: 100, from_result: 0, from_posts: 100 });
    expect(episodeChangeFrom({ followers: 1000, tier: 'mystery', score: 90, post_likes: 0 }).change).toBe(0);
  });
});
