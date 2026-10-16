/**
 * Generate Posts' prompt pieces (Character Consistency Engine step 4).
 */
const { factsLines, maskLines, woundOf } = require('../../../src/services/characterPosts');

describe('characterPosts prompt pieces', () => {
  const facts = {
    handle: '@slowsift', followers: { label: '2M' }, account_status: 'gone_dark', occupation: 'Slow-fashion creator',
    income: { amount: 9000, cadence: 'per_month', source: 'brand deals' }, major_possessions: ['a linen studio'],
    affordability: { label: 'Comfortable' }, undecided: [],
  };

  test('states each fact, with what they can afford', () => {
    const out = factsLines(facts);
    expect(out).toContain('- handle: @slowsift');
    expect(out).toContain('- followers: 2M');
    expect(out).toMatch(/gone dark: they stopped posting/);
    expect(out).toContain('- income: 9000 a month from brand deals');
    expect(out).toContain('- what they own: a linen studio');
    expect(out).toContain('- what they can afford: Comfortable.');
    expect(out).not.toContain('Not decided yet');
  });

  test('a fact not decided yet is left out and named as not decided, with what it decides', () => {
    const out = factsLines({ ...facts, undecided: ['income', 'followers'] });
    expect(out).not.toContain('followers: 2M');
    expect(out).not.toContain('- income:');
    expect(out).not.toContain('can afford');
    expect(out).toContain('Not decided yet: income, followers.');
  });

  test('no facts yet says so', () => {
    expect(factsLines({ undecided: [] })).toContain('- (none set yet)');
  });

  test('the mask comes from the character and the feed profile; the wound stays apart', () => {
    const c = { mask_persona: 'Never tries.', the_mask: { line: 'Effortless' }, core_wound: 'Worthless without achievement.' };
    const mask = maskLines(c, { public_persona: 'Slow-fashion purist' });
    expect(mask).toContain('mask persona: Never tries.');
    expect(mask).toContain('the mask: {"line":"Effortless"}');
    expect(mask).toContain('public persona: Slow-fashion purist');
    expect(mask).not.toContain('Worthless');
    expect(woundOf(c)).toEqual({ core_wound: 'Worthless without achievement.' });
    expect(maskLines({}, null)).toMatch(/not written yet/);
  });
});
