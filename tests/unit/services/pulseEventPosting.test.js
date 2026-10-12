/**
 * Who would post when an event happens (Task #2970): attending first, then
 * closeness to Lala and temperament; a seeded jitter keeps re-runs stable;
 * lurkers never post but may comment.
 */
const { seeded, scoreOf, pick, POST_LINE, COMMENT_LINE, MAX_POSTERS } = require('../../../src/services/pulseEventPosting');

describe('seeded', () => {
  test('stable per seed, spread across seeds, 0 to 1', () => {
    expect(seeded('ep:a')).toBe(seeded('ep:a'));
    const values = Array.from({ length: 30 }, (_, i) => seeded(`ep:${i}`));
    expect(new Set(values).size).toBe(30);
    expect(values.every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});

describe('scoreOf', () => {
  const s = (over) => scoreOf({ attended: false, closeness: 0, temperament: 'regular', seed: 'x', ...over });

  test('attending counts most, then closeness, then temperament', () => {
    expect(s({ attended: true }) - s({})).toBeCloseTo(0.5, 5);
    expect(s({ closeness: 1 }) - s({})).toBeCloseTo(0.3, 5);
    expect(s({ temperament: 'oversharer' }) - s({ temperament: 'lurker' })).toBeCloseTo(0.16, 5);
  });

  test('an attending oversharer posts; a stranger who stayed home does not even comment', () => {
    expect(s({ attended: true, temperament: 'oversharer' })).toBeGreaterThanOrEqual(POST_LINE);
    expect(s({ temperament: 'lurker' })).toBeLessThan(COMMENT_LINE);
  });
});

describe('pick', () => {
  const c = (characterId, score, temperament = 'regular') => ({ characterId, score, temperament });

  test('posters above the line, best first; lurkers never post but comment; the rest above the comment line comment', () => {
    const { posters, commenters } = pick([c('a', 0.9), c('b', 0.7, 'lurker'), c('c', 0.6), c('d', 0.4), c('e', 0.1)]);
    expect(posters.map((x) => x.characterId)).toEqual(['a', 'c']);
    expect(commenters.map((x) => x.characterId)).toEqual(['b', 'd']);
  });

  test('at most MAX_POSTERS post', () => {
    const many = Array.from({ length: 8 }, (_, i) => c(`p${i}`, 0.9 - i * 0.01));
    expect(pick(many).posters).toHaveLength(MAX_POSTERS);
  });
});
