/**
 * Ruling D15 and answers 8–12 (Evoni, 2026-09-30): real influencer formats,
 * natural labels, and how each is priced from the rate card.
 */
const {
  DELIVERABLE_FORMATS, deliverableTypeLabel, deliverablePhrase, formatAnchorPrice, roundTo5, platformOf, quantityOf,
} = require('../../../src/utils/deliverableFormats');
const { V2_NEW_ANCHORS } = require('../../../src/migrations/20261001160000-add-deliverable-formats');

const REEL = [75, 125, 225, 325, 450];
const STORIES_3 = [35, 60, 110, 160, 225];
const card = {
  anchors: {
    reel: Object.fromEntries(REEL.map((a, i) => [i + 1, a])),
    stories_3: Object.fromEntries(STORIES_3.map((a, i) => [i + 1, a])),
    ...Object.fromEntries(Object.entries(V2_NEW_ANCHORS).map(([k, list]) => [k, Object.fromEntries(list.map((a, i) => [i + 1, a]))])),
  },
};

describe('labels and phrases (D15: "1 TikTok GRWM, 3 Instagram Stories")', () => {
  test('"Story Set (3)" is renamed "Instagram Stories (×3)"', () => {
    expect(deliverableTypeLabel({ deliverable_type: 'instagram_stories', quantity: 3 })).toBe('Instagram Stories (×3)');
    expect(deliverablePhrase({ deliverable_type: 'instagram_stories', quantity: 3 })).toBe('3 Instagram Stories');
    expect(deliverablePhrase({ deliverable_type: 'instagram_stories', quantity: 1 })).toBe('1 Instagram Story');
  });

  test('the platform is named where the format goes on several', () => {
    expect(deliverablePhrase({ deliverable_type: 'grwm_video', platform: 'tiktok', quantity: 1 })).toBe('1 TikTok GRWM');
    expect(deliverablePhrase({ deliverable_type: 'go_live', platform: 'instagram', quantity: 2 })).toBe('2 Instagram Lives');
    expect(deliverablePhrase({ deliverable_type: 'carousel_post', platform: 'instagram', quantity: 1 })).toBe('1 Instagram carousel post');
    expect(deliverablePhrase({ deliverable_type: 'try_on_haul', platform: 'youtube', quantity: 1 })).toBe('1 YouTube try-on/haul video');
  });

  test('single-platform formats read as their name', () => {
    expect(deliverablePhrase({ deliverable_type: 'instagram_reel', quantity: 1 })).toBe('1 Instagram Reel');
    expect(deliverablePhrase({ deliverable_type: 'tiktok_video', quantity: 2 })).toBe('2 TikTok videos');
    expect(deliverablePhrase({ deliverable_type: 'instagram_post', quantity: 1 })).toBe('1 Instagram post');
    expect(deliverablePhrase({ deliverable_type: 'ugc', quantity: 2 })).toBe('2 UGC pieces for the brand');
  });

  test('link in bio counts days', () => {
    expect(deliverableTypeLabel({ deliverable_type: 'link_in_bio', quantity: 7 })).toBe('Link in bio (7 days)');
    expect(deliverablePhrase({ deliverable_type: 'link_in_bio', quantity: 10, platform: 'tiktok' })).toBe('Link in bio on TikTok (10 days)');
  });

  test('a quantity of one shows no multiplier; an untyped row has no label', () => {
    expect(deliverableTypeLabel({ deliverable_type: 'instagram_reel', quantity: 1 })).toBe('Instagram Reel');
    expect(deliverableTypeLabel({ deliverable_type: 'tiktok_video', quantity: 2 })).toBe('TikTok video (×2)');
    expect(deliverableTypeLabel({ deliverable_type: 'Sponsored post' })).toBeNull();
    expect(deliverablePhrase({ deliverable_type: null })).toBeNull();
  });

  test('platform and quantity defaults', () => {
    expect(platformOf({ deliverable_type: 'instagram_reel' })).toBe('instagram');
    expect(platformOf({ deliverable_type: 'grwm_video' })).toBeNull();
    expect(platformOf({ deliverable_type: 'ugc' })).toBeNull();
    expect(quantityOf({ deliverable_type: 'instagram_stories' })).toBe(3);
    expect(quantityOf({ deliverable_type: 'link_in_bio' })).toBe(7);
    expect(quantityOf({ deliverable_type: 'instagram_reel', quantity: 0 })).toBe(1);
  });
});

describe('pricing (answers 8–12)', () => {
  test('rounding to the nearest 5, halves up (answer 9)', () => {
    expect(roundTo5(112.5)).toBe(115);
    expect(roundTo5(37.5)).toBe(40);
    expect(roundTo5(11.67)).toBe(10);
    expect(roundTo5(12.5)).toBe(15);
  });

  test('the v2 anchors are D15\'s proportions of the Reel anchor, rounded to 5 (answer 8 adds Instagram post at 0.5×)', () => {
    const times = {
      tiktok_video: 1.0, grwm_video: 1.2, instagram_post: 0.5, carousel_post: 0.6,
      go_live: 1.5, try_on_haul: 1.0, ugc: 0.8, link_in_bio_week: 0.3,
    };
    for (const [component, x] of Object.entries(times)) {
      expect(V2_NEW_ANCHORS[component]).toEqual(REEL.map((r) => roundTo5(r * x)));
    }
  });

  test('per piece: anchor × quantity; platform never changes it (answer 12)', () => {
    expect(formatAnchorPrice({ deliverable_type: 'instagram_reel', quantity: 1 }, 3, card)).toBe(225);
    expect(formatAnchorPrice({ deliverable_type: 'grwm_video', platform: 'tiktok', quantity: 2 }, 3, card)).toBe(540);
    expect(formatAnchorPrice({ deliverable_type: 'grwm_video', platform: 'youtube', quantity: 2 }, 3, card)).toBe(540);
    expect(formatAnchorPrice({ deliverable_type: 'instagram_post', quantity: 1 }, 1, card)).toBe(40);
  });

  test('Instagram Stories: the 3-slide anchor ÷ 3 × N, rounded to 5 (answer 10)', () => {
    expect(formatAnchorPrice({ deliverable_type: 'instagram_stories', quantity: 3 }, 1, card)).toBe(35);
    expect(formatAnchorPrice({ deliverable_type: 'instagram_stories', quantity: 1 }, 1, card)).toBe(10);
    expect(formatAnchorPrice({ deliverable_type: 'instagram_stories', quantity: 5 }, 3, card)).toBe(185);
  });

  test('link in bio: per started week (answer 11)', () => {
    expect(formatAnchorPrice({ deliverable_type: 'link_in_bio', quantity: 7 }, 2, card)).toBe(40);
    expect(formatAnchorPrice({ deliverable_type: 'link_in_bio', quantity: 10 }, 2, card)).toBe(80);
    expect(formatAnchorPrice({ deliverable_type: 'link_in_bio', quantity: 1 }, 5, card)).toBe(135);
  });

  test('Other and untyped rows are never priced; a missing anchor is null', () => {
    expect(formatAnchorPrice({ deliverable_type: 'other', quantity: 1 }, 3, card)).toBeNull();
    expect(formatAnchorPrice({ deliverable_type: 'Sponsored post' }, 3, card)).toBeNull();
    expect(formatAnchorPrice({ deliverable_type: 'go_live', quantity: 1 }, 3, { anchors: {} })).toBeNull();
  });

  test('every format but Other has an anchor', () => {
    for (const [key, f] of Object.entries(DELIVERABLE_FORMATS)) {
      if (key === 'other') expect(f.anchor).toBeNull();
      else expect(typeof f.anchor).toBe('string');
    }
  });
});
