/**
 * Shared audiences, the pure parts (Evoni's idea 4, 2026-10-17): the
 * defaults name only the fifteen default types; links read both ways;
 * competing outranks sharing in kind; the same type is the same lane; links
 * normalize to names on the list; the commenting score's audience bonus.
 */
const { DEFAULT_AUDIENCE, SCORES, normalizeLinks, affinity, loadAudienceMap } = require('../../../src/services/audienceMap');
const { DEFAULT_ARCHETYPES } = require('../../../src/services/societyArchetypes');
const { commentScoreOf, AUDIENCE_WEIGHT } = require('../../../src/services/pulseEventPosting');

const names = DEFAULT_ARCHETYPES.map((a) => a.name);

test('the defaults cover the fifteen default types and name only them, never themselves', () => {
  expect(Object.keys(DEFAULT_AUDIENCE).sort()).toEqual([...names].sort());
  for (const [type, { shares, competes }] of Object.entries(DEFAULT_AUDIENCE)) {
    for (const n of [...shares, ...competes]) {
      expect(names).toContain(n);
      expect(n).not.toBe(type);
    }
  }
});

describe('affinity', () => {
  let map;
  beforeAll(async () => { map = await loadAudienceMap(null); });

  test('shares, read both ways', () => {
    expect(affinity(map, 'The Beauty Oracle', 'The Trendsetter')).toEqual({ kind: 'shares', score: SCORES.shares });
    // The Archivist lists The Educator; The Educator lists The Archivist too; The Commentator is listed only by The Archivist.
    expect(affinity(map, 'The Commentator', 'The Archivist')).toEqual({ kind: 'shares', score: SCORES.shares });
  });

  test('competing wins over sharing in kind; the same type is the same lane; else nothing', () => {
    expect(affinity(map, 'The Luxury Icon', 'The Relatable Friend')).toEqual({ kind: 'competes', score: SCORES.competes });
    expect(affinity(map, 'the trendsetter', 'The Archivist').kind).toBe('competes');
    expect(affinity(map, 'The Rebel', 'Rebel')).toEqual({ kind: 'same', score: SCORES.same });
    expect(affinity(map, 'The Educator', 'The Viral Wildcard')).toEqual({ kind: null, score: 0 });
    expect(affinity(map, null, 'The Rebel')).toEqual({ kind: null, score: 0 });
  });
});

test('links normalize to names on the list, not the type itself, first of a name', () => {
  const list = DEFAULT_ARCHETYPES;
  expect(normalizeLinks({ shares: ['trendsetter', 'The Trendsetter', 'The Night Owl', 'The Beauty Oracle'], competes: 'x' }, list, 'The Beauty Oracle'))
    .toEqual({ shares: ['The Trendsetter'], competes: [] });
});

test('the commenting score: audience is a bonus on top, so no type scores as before', () => {
  expect(commentScoreOf({ attended: true, closeness: 0, temperament: 'lurker' })).toBe(0.34);
  expect(commentScoreOf({ attended: true, closeness: 0, temperament: 'lurker', audience: 0 })).toBe(0.34);
  expect(commentScoreOf({ attended: false, closeness: 0, temperament: 'oversharer', audience: 1 })).toBe(0.2 + AUDIENCE_WEIGHT);
  expect(commentScoreOf({ attended: false, closeness: 0, temperament: 'regular', audience: 1 })).toBeLessThan(0.3);
});
