/**
 * The content mix's pure parts (idea 3, 2026-10-17): the defaults cover
 * the fifteen default types and each sums to 100; pillars normalize (named,
 * first of a name, at most six, shares scaled to 100); the plan picks the
 * pillar furthest below its share, counting the plan so far.
 */
const {
  DEFAULT_PILLARS, normalizePillars, planPillars, pillarsLine, matchPillar, MAX_PILLARS,
} = require('../../../src/services/contentPillars');
const { DEFAULT_ARCHETYPES } = require('../../../src/services/societyArchetypes');

test('every default type has a default mix that sums to 100', () => {
  expect(Object.keys(DEFAULT_PILLARS).sort()).toEqual(DEFAULT_ARCHETYPES.map((a) => a.name).sort());
  for (const [name, pillars] of Object.entries(DEFAULT_PILLARS)) {
    expect([name, pillars.reduce((a, p) => a + p.share, 0)]).toEqual([name, 100]);
    expect(normalizePillars(pillars)).toEqual(pillars.map((p) => ({ ...p })));
  }
});

describe('normalizePillars', () => {
  test('scales shares to whole percents summing to 100', () => {
    expect(normalizePillars([{ name: 'A', share: 1 }, { name: 'B', share: 1 }, { name: 'C', share: 1 }]).map((p) => p.share)).toEqual([34, 33, 33]);
    expect(normalizePillars([{ name: 'A', share: 3 }, { name: 'B', share: 1 }]).map((p) => p.share)).toEqual([75, 25]);
    expect(normalizePillars([{ name: 'A' }, { name: 'B' }]).map((p) => p.share)).toEqual([50, 50]);
  });

  test('keeps named pillars, the first of a name, at most six', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `P${i}`, share: 10 }));
    expect(normalizePillars(many)).toHaveLength(MAX_PILLARS);
    expect(normalizePillars([{ name: '' }, { name: 'Skit', share: 5 }, { name: 'skit', share: 9 }])).toEqual([{ name: 'Skit', share: 100, example: '' }]);
    expect(normalizePillars(null)).toEqual([]);
  });
});

describe('planPillars', () => {
  const mix = [{ name: 'Tutorial', share: 50 }, { name: 'Verdict', share: 30 }, { name: 'Over', share: 20 }];

  test('with no history, the biggest first, then whichever falls furthest behind', () => {
    expect(planPillars(mix, {}, 5).map((p) => p.name)).toEqual(['Tutorial', 'Verdict', 'Over', 'Tutorial', 'Tutorial']);
  });

  test('after four tutorials, the others come first', () => {
    expect(planPillars(mix, { tutorial: 4 }, 2).map((p) => p.name)).toEqual(['Verdict', 'Over']);
  });

  test('no pillars, no plan; a pillar off the mix in history is ignored', () => {
    expect(planPillars([], {}, 3)).toEqual([]);
    expect(planPillars(mix, { Elsewhere: 9 }, 1).map((p) => p.name)).toEqual(['Tutorial']);
  });
});

test('the prompt line and matching a pillar by name', () => {
  expect(pillarsLine([{ name: 'Skit', share: 60, example: 'a bit' }, { name: 'Reaction', share: 40, example: '' }]))
    .toBe('Their content mix (the kinds of post they make, with each one\'s share of their posts): Skit 60% (e.g. a bit); Reaction 40%.');
  expect(pillarsLine([])).toBe('');
  expect(matchPillar([{ name: 'Product verdict' }], 'product verdict')).toEqual({ name: 'Product verdict' });
  expect(matchPillar([{ name: 'Product verdict' }], 'nope')).toBeNull();
});
