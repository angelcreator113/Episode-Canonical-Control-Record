/**
 * normaliseLocations (Evoni's ruling L6 and her answer to Q15, 2026-10-02,
 * docs/EVENT_EPISODE_FLOW.md §8(hh)): "roles are home, closet, event (one)
 * and extra; any number of extras, each with a free name (per L6)."
 */
const { normaliseLocations, EpisodeLocationsError } = require('../../../src/services/episodeLocationsService');

const extra = (i) => ({ role: 'extra', scene_set_id: `set-x${i}`, name: `Extra ${i}` });

describe('normaliseLocations (Q15)', () => {
  test('any number of named extras is accepted', () => {
    const list = [{ role: 'home', scene_set_id: 'set-home' }, ...Array.from({ length: 30 }, (_, i) => extra(i + 1))];
    const out = normaliseLocations(list);
    expect(out).toHaveLength(31);
    expect(out.filter((l) => l.role === 'extra')).toHaveLength(30);
  });

  test('orders event, home, closet, then extras in the order given', () => {
    const out = normaliseLocations([
      extra(1),
      { role: 'closet', scene_set_id: 'set-closet' },
      { role: 'event', scene_set_id: 'set-venue' },
      extra(2),
      { role: 'home', scene_set_id: 'set-home' },
    ]);
    expect(out.map((l) => l.role)).toEqual(['event', 'home', 'closet', 'extra', 'extra']);
    expect(out.slice(3).map((l) => l.name)).toEqual(['Extra 1', 'Extra 2']);
  });

  test('one event set only', () => {
    expect(() => normaliseLocations([
      { role: 'event', scene_set_id: 'set-a' },
      { role: 'event', scene_set_id: 'set-b' },
    ])).toThrow(EpisodeLocationsError);
  });

  test('an extra needs a name, and a set holds one role', () => {
    expect(() => normaliseLocations([{ role: 'extra', scene_set_id: 'set-a', name: '  ' }])).toThrow(EpisodeLocationsError);
    expect(() => normaliseLocations([
      { role: 'home', scene_set_id: 'set-a' },
      { role: 'extra', scene_set_id: 'set-a', name: 'Car' },
    ])).toThrow(EpisodeLocationsError);
  });
});
