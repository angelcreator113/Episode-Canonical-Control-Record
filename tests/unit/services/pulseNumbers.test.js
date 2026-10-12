/**
 * Post numbers on The Pulse (Task #2953): each factor's part in a proposal,
 * a seed that always gives the same numbers, and the growth curve.
 */
const {
  postKind, randomFactor, numbersFrom, isAboutLala, numbersAt, KIND_RATES, TREND_BOOST, EPISODE_TIER,
} = require('../../../src/services/pulseNumbers');

describe('postKind', () => {
  test.each([
    [{ post_type: 'post', image_url: 'x.jpg' }, 'fit'],
    [{ post_type: 'reel', image_description: 'a look' }, 'fit'],
    [{ post_type: 'tweet', narrative_function: 'flex' }, 'fit'],
    [{ post_type: 'post' }, 'status'],
    [{ post_type: 'tweet' }, 'status'],
    [{ post_type: 'notification' }, 'announcement'],
    [{ post_type: 'post', image_url: 'x.jpg', narrative_function: 'brand_content' }, 'announcement'],
    [{ post_type: 'dm_screenshot' }, 'other'],
  ])('%p → %s', (post, kind) => expect(postKind(post)).toBe(kind));
});

describe('randomFactor', () => {
  test('the same seed always gives the same factor, within 0.85 to 1.15', () => {
    for (const seed of [1, 42, 123456789, 2147483646]) {
      const f = randomFactor(seed);
      expect(randomFactor(seed)).toBe(f);
      expect(f).toBeGreaterThanOrEqual(0.85);
      expect(f).toBeLessThanOrEqual(1.15);
    }
  });

  test('different seeds spread out', () => {
    const factors = new Set(Array.from({ length: 50 }, (_, i) => randomFactor(i * 7919 + 1)));
    expect(factors.size).toBeGreaterThan(30);
  });
});

describe('numbersFrom', () => {
  const base = { followers: 100000, kind: 'status', trending: false, episode_tier: null, random: 1 };

  test('followers × the kind\'s rate; shares a fraction of likes', () => {
    expect(numbersFrom(base)).toEqual({ likes: 2000, shares: 160 });
    expect(numbersFrom({ ...base, kind: 'fit' })).toEqual({ likes: 100000 * KIND_RATES.fit.likes, shares: Math.round(6000 * KIND_RATES.fit.shares) });
  });

  test('a trend, the episode result and the random factor each multiply', () => {
    expect(numbersFrom({ ...base, trending: true }).likes).toBe(Math.round(2000 * TREND_BOOST));
    expect(numbersFrom({ ...base, episode_tier: 'slay' }).likes).toBe(Math.round(2000 * EPISODE_TIER.slay));
    expect(numbersFrom({ ...base, episode_tier: 'fail' }).likes).toBe(Math.round(2000 * EPISODE_TIER.fail));
    expect(numbersFrom({ ...base, random: 1.1 }).likes).toBe(2200);
  });

  test('no followers, no likes', () => {
    expect(numbersFrom({ ...base, followers: 0 })).toEqual({ likes: 0, shares: 0 });
  });

  test('the same factors and seed always give the same numbers', () => {
    const factors = { ...base, kind: 'fit', trending: true, episode_tier: 'pass', random: randomFactor(98765) };
    expect(numbersFrom({ ...factors, random: randomFactor(98765) })).toEqual(numbersFrom(factors));
  });
});

describe('isAboutLala', () => {
  test.each([
    ['Saw @lala at the gala', true],
    ["Lala's fit tonight 🔥", true],
    ['LALA!!', true],
    ['Welcome to the LalaVerse', false],
    ['lalaland vibes', false],
    ['no mention', false],
  ])('%s → %s', (text, about) => expect(isAboutLala({ content_text: text })).toBe(about));
});

describe('numbersAt (the growth curve)', () => {
  const row = { status: 'accepted', final_likes: 1000, final_shares: 100, story_order: 27 };

  test('55% at its moment, 85% one moment later, all of it from two on', () => {
    expect(numbersAt(row, 27)).toEqual({ likes: 550, shares: 55 });
    expect(numbersAt(row, 28)).toEqual({ likes: 850, shares: 85 });
    expect(numbersAt(row, 29)).toEqual({ likes: 1000, shares: 100 });
    expect(numbersAt(row, 45)).toEqual({ likes: 1000, shares: 100 });
  });

  test('a moment is a phase: during to after is one, and a week later to the next episode start is one', () => {
    expect(numbersAt({ ...row, story_order: 25 }, 27)).toEqual({ likes: 850, shares: 85 });
    expect(numbersAt({ ...row, story_order: 29 }, 31)).toEqual({ likes: 850, shares: 85 });
  });

  test('before the post, nothing; not canon yet, nothing; an unknown moment shows it all', () => {
    expect(numbersAt(row, 25)).toBeNull();
    expect(numbersAt({ ...row, status: 'proposed', final_likes: null }, 29)).toBeNull();
    expect(numbersAt(row, undefined)).toEqual({ likes: 1000, shares: 100 });
    expect(numbersAt({ ...row, story_order: null }, 27)).toEqual({ likes: 1000, shares: 100 });
  });
});
