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

describe('the FACTS block and the guard (step 5: generators read the facts)', () => {
  const { factsPromptBlock, isDecided, holdToFacts } = require('../../../src/services/characterFacts');
  const FACTS = {
    handle: '@slowsift', followers: { count: 2000000, label: '2M' }, account_status: 'gone_dark',
    income: { amount: 9000, cadence: 'per_month', source: 'brand deals' }, occupation: 'Slow-fashion creator',
    major_possessions: ['a linen studio'], affordability: { key: 'comfortable', label: 'Comfortable' }, undecided: [],
  };

  test('states each decided fact exactly, with what they can afford', () => {
    const block = factsPromptBlock(FACTS);
    expect(block).toMatch(/^FACTS \(canon, the one source of truth\)/);
    expect(block).toContain('- handle: @slowsift');
    expect(block).toContain('- followers: 2M (2,000,000)');
    expect(block).toContain('- account status: gone dark (they stopped posting)');
    expect(block).toContain('- what they do: Slow-fashion creator');
    expect(block).toContain('- income: 9,000 a month from brand deals');
    expect(block).toContain('- what they own: a linen studio');
    expect(block).toContain('- what they can afford: Comfortable.');
    expect(block).not.toContain('NOT DECIDED YET');
  });

  test('an undecided fact is left out and named; nothing at all is no block', () => {
    const block = factsPromptBlock({ ...FACTS, undecided: ['income', 'followers'] });
    expect(block).not.toContain('2M');
    expect(block).not.toContain('- income:');
    expect(block).not.toContain('can afford');
    expect(block).toContain('NOT DECIDED YET: income, followers. Never state, imply or invent these.');
    expect(factsPromptBlock({ undecided: [] })).toBe('');
    expect(factsPromptBlock(null)).toBe('');
    expect(isDecided(FACTS, 'followers')).toBe(true);
    expect(isDecided({ ...FACTS, undecided: ['followers'] }, 'followers')).toBe(false);
    expect(isDecided({ ...FACTS, major_possessions: [] }, 'major_possessions')).toBe(false);
  });

  test('the guard sets what a fact decides and clears what it leaves undecided', () => {
    expect(holdToFacts('career_status', { profession: 'Model', financial_status: 'rich', career_goal: 'x' }, FACTS))
      .toEqual({ profession: 'Slow-fashion creator', financial_status: 'rich', career_goal: 'x' });
    expect(holdToFacts('career_status', { profession: 'Model', financial_status: 'rich' }, { ...FACTS, undecided: ['income', 'occupation'] }))
      .toEqual({ profession: null, financial_status: null });
    expect(holdToFacts('demographics', { follower_tier: 'micro', age: 30 }, FACTS)).toEqual({ follower_tier: 'mega', age: 30 });
    expect(holdToFacts('living_context', { financial_reality: 'loaded' }, { ...FACTS, undecided: ['income'] })).toEqual({ financial_reality: null });
    // Untouched: other sections, fields not in the answer, no facts.
    expect(holdToFacts('aesthetic_dna', { palette: 'linen' }, FACTS)).toEqual({ palette: 'linen' });
    expect(holdToFacts('career_status', { career_goal: 'x' }, FACTS)).toEqual({ career_goal: 'x' });
    expect(holdToFacts('career_status', { profession: 'Model' }, null)).toEqual({ profession: 'Model' });
  });
});
