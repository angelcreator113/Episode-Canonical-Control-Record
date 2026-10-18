/**
 * Ruling D15 and answers 8–12 (Evoni, 2026-09-30): influencer formats,
 * natural labels, and how each is priced from the rate card. On The Pulse
 * since 2026-10-18: one platform, three accounts (The Pulse, a private Pulse
 * account, The PlayRoom); a Reel and a TikTok video are one Pulse video.
 */
const {
  DELIVERABLE_FORMATS, deliverableTypeLabel, deliverablePhrase, formatAnchorPrice, roundTo5, platformOf, quantityOf,
} = require('../../../src/utils/deliverableFormats');
const { V2_NEW_ANCHORS } = require('../../../src/migrations/20261001160000-add-deliverable-formats');

const REEL = [75, 125, 225, 325, 450];
const STORIES_3 = [35, 60, 110, 160, 225];
const byTier = (list) => Object.fromEntries(list.map((a, i) => [i + 1, a]));
// The v2 card as 20261018130000-pulse-deliverables renamed it.
const { tiktok_video: _merged, instagram_post: post, ...rest } = V2_NEW_ANCHORS;
const card = {
  anchors: {
    pulse_video: byTier(REEL),
    pulse_stories_3: byTier(STORIES_3),
    pulse_post: byTier(post),
    ...Object.fromEntries(Object.entries(rest).map(([k, list]) => [k, byTier(list)])),
  },
};

describe('labels and phrases (D15, on The Pulse: "1 Pulse video, 3 Pulse stories")', () => {
  test('"Story Set (3)" is "Pulse stories (×3)"', () => {
    expect(deliverableTypeLabel({ deliverable_type: 'pulse_stories', quantity: 3 })).toBe('Pulse stories (×3)');
    expect(deliverablePhrase({ deliverable_type: 'pulse_stories', quantity: 3 })).toBe('3 Pulse stories');
    expect(deliverablePhrase({ deliverable_type: 'pulse_stories', quantity: 1 })).toBe('1 Pulse story');
  });

  test('an account other than the public one is named; The Pulse is not', () => {
    expect(deliverablePhrase({ deliverable_type: 'grwm_video', platform: 'pulse', quantity: 1 })).toBe('1 GRWM Pulse video');
    expect(deliverablePhrase({ deliverable_type: 'go_live', platform: 'pulse_private', quantity: 2 })).toBe('2 Pulse lives on a private Pulse account');
    expect(deliverablePhrase({ deliverable_type: 'carousel_post', platform: 'pulse', quantity: 1 })).toBe('1 Pulse carousel');
    expect(deliverablePhrase({ deliverable_type: 'try_on_haul', platform: 'playroom', quantity: 1 })).toBe('1 try-on/haul video on The PlayRoom');
    expect(deliverablePhrase({ deliverable_type: 'pulse_stories', platform: 'pulse_private', quantity: 3 })).toBe('3 Pulse stories on a private Pulse account');
  });

  test('a row with no account reads as on The Pulse', () => {
    expect(deliverablePhrase({ deliverable_type: 'pulse_video', quantity: 1 })).toBe('1 Pulse video');
    expect(deliverablePhrase({ deliverable_type: 'pulse_video', quantity: 2 })).toBe('2 Pulse videos');
    expect(deliverablePhrase({ deliverable_type: 'pulse_post', quantity: 1 })).toBe('1 Pulse post');
    expect(deliverablePhrase({ deliverable_type: 'ugc', quantity: 2 })).toBe('2 UGC pieces for the brand');
  });

  test('no format names a real app', () => {
    const words = JSON.stringify(DELIVERABLE_FORMATS);
    expect(words).not.toMatch(/instagram|tiktok|youtube|reel/i);
    expect(Object.keys(DELIVERABLE_FORMATS)).not.toContain('tiktok_video');
  });

  test('a profile link counts days', () => {
    expect(deliverableTypeLabel({ deliverable_type: 'link_in_bio', quantity: 7 })).toBe('Profile link (7 days)');
    expect(deliverablePhrase({ deliverable_type: 'link_in_bio', quantity: 7 })).toBe('Profile link (7 days)');
    expect(deliverablePhrase({ deliverable_type: 'link_in_bio', quantity: 10, platform: 'pulse_private' })).toBe('Profile link on a private Pulse account (10 days)');
  });

  test('a quantity of one shows no multiplier; an untyped row has no label', () => {
    expect(deliverableTypeLabel({ deliverable_type: 'pulse_video', quantity: 1 })).toBe('Pulse video');
    expect(deliverableTypeLabel({ deliverable_type: 'pulse_video', quantity: 2 })).toBe('Pulse video (×2)');
    expect(deliverableTypeLabel({ deliverable_type: 'Sponsored post' })).toBeNull();
    expect(deliverablePhrase({ deliverable_type: null })).toBeNull();
  });

  test('account and quantity defaults', () => {
    expect(platformOf({ deliverable_type: 'pulse_video' })).toBe('pulse');
    expect(platformOf({ deliverable_type: 'grwm_video' })).toBe('pulse');
    expect(platformOf({ deliverable_type: 'grwm_video', platform: 'playroom' })).toBe('playroom');
    expect(platformOf({ deliverable_type: 'grwm_video', platform: 'instagram' })).toBe('pulse');
    expect(platformOf({ deliverable_type: 'ugc' })).toBeNull();
    expect(quantityOf({ deliverable_type: 'pulse_stories' })).toBe(3);
    expect(quantityOf({ deliverable_type: 'link_in_bio' })).toBe(7);
    expect(quantityOf({ deliverable_type: 'pulse_video', quantity: 0 })).toBe(1);
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

  test('per piece: anchor × quantity; the account never changes it (answer 12)', () => {
    expect(formatAnchorPrice({ deliverable_type: 'pulse_video', quantity: 1 }, 3, card)).toBe(225);
    expect(formatAnchorPrice({ deliverable_type: 'grwm_video', platform: 'pulse', quantity: 2 }, 3, card)).toBe(540);
    expect(formatAnchorPrice({ deliverable_type: 'grwm_video', platform: 'playroom', quantity: 2 }, 3, card)).toBe(540);
    expect(formatAnchorPrice({ deliverable_type: 'pulse_post', quantity: 1 }, 1, card)).toBe(40);
  });

  test('Pulse stories: the 3-slide anchor ÷ 3 × N, rounded to 5 (answer 10)', () => {
    expect(formatAnchorPrice({ deliverable_type: 'pulse_stories', quantity: 3 }, 1, card)).toBe(35);
    expect(formatAnchorPrice({ deliverable_type: 'pulse_stories', quantity: 1 }, 1, card)).toBe(10);
    expect(formatAnchorPrice({ deliverable_type: 'pulse_stories', quantity: 5 }, 3, card)).toBe(185);
  });

  test('a profile link: per started week (answer 11)', () => {
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
