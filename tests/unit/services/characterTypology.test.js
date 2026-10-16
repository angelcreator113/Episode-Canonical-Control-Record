'use strict';

/**
 * The typology seed (Character Consistency Engine step 6a).
 */
const { normalizeTypology, typologyLabel, seedBlock, voiceDial, wingsOf, TypologyError } = require('../../../src/services/characterTypology');

describe('characterTypology', () => {
  test('a wing is a type either side, round the circle', () => {
    expect(wingsOf(3)).toEqual([2, 4]);
    expect(wingsOf(1)).toEqual([9, 2]);
    expect(wingsOf(9)).toEqual([8, 1]);
  });

  test('normalizes a typology and stamps who set it', () => {
    const t = normalizeTypology({ enneagram: { type: '3', wing: 4 }, mbti: 'infj', why: '  Image first.  ' }, { by: 'evoni', now: new Date('2026-10-16T00:00:00Z') });
    expect(t).toEqual({ enneagram: { type: 3, wing: 4 }, mbti: 'INFJ', why: 'Image first.', set_by: 'evoni', set_at: '2026-10-16T00:00:00.000Z' });
    expect(normalizeTypology({ enneagram: { type: 9 } })).toMatchObject({ enneagram: { type: 9, wing: null }, mbti: null, why: null });
  });

  test('refuses a type off the circle, a wing that is not beside it, or an unknown MBTI', () => {
    expect(() => normalizeTypology({ enneagram: { type: 10 } })).toThrow(TypologyError);
    expect(() => normalizeTypology({ enneagram: { type: 3, wing: 7 } })).toThrow(/Type 3's wing is 2 or 4/);
    expect(() => normalizeTypology({ enneagram: { type: 3 }, mbti: 'XXXX' })).toThrow(/16 four-letter types/);
  });

  test('the seed block and the voice dial', () => {
    const t = { enneagram: { type: 3, wing: 4 }, mbti: 'ENTJ', why: 'Her worth is her output.' };
    expect(typologyLabel(t)).toBe('Type 3w4, The Achiever');
    const block = seedBlock(t);
    expect(block).toMatch(/^TYPOLOGY SEED/);
    expect(block).toContain('Core fear: being worthless without achievement.');
    expect(block).toContain('The 4 wing colours it with the Individualist');
    expect(block).toContain('Why this type: Her worth is her output.');
    expect(block).toContain('want, wound, mask, forbidden want and dilemma descend from this type');
    expect(voiceDial(t)).toBe('MBTI dial: ENTJ. It tunes how they phrase things (directness, abstraction, warmth), not who they are or what they want.');
    expect(seedBlock(null)).toBe('');
    expect(voiceDial({ enneagram: { type: 3 } })).toBe('');
    expect(typologyLabel({})).toBe('');
  });
});
