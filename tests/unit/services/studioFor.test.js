'use strict';

/**
 * A creator's studio type (Evoni, 2026-10-18: every studio read "venue ·
 * other"): the niche's words first, then the content type, else none.
 */
const { studioFor, STUDIO_TYPES } = require('../../../src/services/feedHomeLocation');

describe('studioFor', () => {
  test.each([
    ['vintage streetwear', null, 'boutique', 'Showroom'],
    ['skincare and makeup', null, 'salon', 'Studio'],
    ['beat tapes and DJ sets', null, 'recording_studio', 'Studio'],
    ['TikTok documentary', 'The Rebel', 'studio', 'Studio'],
    ['money and investing', null, 'office', 'Office'],
    ['beauty', null, 'salon', 'Studio'],
  ])('niche %s → %s', (niche, type, venue, label) => {
    expect(studioFor({ content_category: niche, society_archetype: type })).toMatchObject({ type: venue, label, why: `their niche is ${niche}` });
  });

  test('no niche word: the content type decides', () => {
    expect(studioFor({ content_category: 'controversial opinions', society_archetype: 'The Luxury Icon' }))
      .toEqual({ type: 'boutique', label: 'Showroom', why: 'they are known as The Luxury Icon' });
  });

  test('neither says: none, so the caller keeps "other"', () => {
    expect(studioFor({ content_category: 'controversial opinions' })).toBeNull();
    expect(studioFor({})).toBeNull();
  });

  test('every type it gives is one the apply step accepts', () => {
    const niches = ['fashion', 'beauty', 'music', 'fitness', 'food', 'wellness', 'art', 'tech', 'comedy', 'travel'];
    for (const n of niches) expect(STUDIO_TYPES).toContain(studioFor({ content_category: n }).type);
  });
});
