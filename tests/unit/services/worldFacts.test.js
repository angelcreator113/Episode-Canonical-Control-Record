/**
 * services/worldFacts — the shared shape of world_state_snapshots.world_facts
 * (review item 8, 2026-10-04): a list of facts, never an object.
 */
const { factsOf, normalizeFacts, temperatureOf } = require('../../../src/services/worldFacts');

describe('factsOf', () => {
  test('reads strings and { fact } objects, trims, drops the rest', () => {
    expect(factsOf({ world_facts: [' Lala moved to Velvet City ', { fact: 'The gala happened' }, { note: 'x' }, 42, ''] }))
      .toEqual(['Lala moved to Velvet City', 'The gala happened']);
  });
  test('an object (the old temperature snapshot), null or no snapshot is no facts', () => {
    expect(factsOf({ world_facts: { worldTemperature: 61, temperatureUpdatedAt: 'x' } })).toEqual([]);
    expect(factsOf({ world_facts: null })).toEqual([]);
    expect(factsOf(null)).toEqual([]);
  });
});

describe('normalizeFacts', () => {
  test('accepts a list of strings or { fact } and drops empty entries', () => {
    expect(normalizeFacts(['a', ' ', { fact: 'b', source: 'ch1' }])).toEqual({ facts: ['a', { fact: 'b', source: 'ch1' }] });
    expect(normalizeFacts(undefined)).toEqual({ facts: [] });
    expect(normalizeFacts(null)).toEqual({ facts: [] });
  });
  test('refuses an object, a string, or a list with a non-fact', () => {
    const error = 'world_facts must be a list of facts (strings, or { fact })';
    expect(normalizeFacts({ worldTemperature: 61 })).toEqual({ error });
    expect(normalizeFacts('one fact')).toEqual({ error });
    expect(normalizeFacts(['a', 7])).toEqual({ error });
    expect(normalizeFacts([{ note: 'no fact key' }])).toEqual({ error });
  });
});

describe('temperatureOf', () => {
  test('reads metadata.world_temperature with a numeric value, else null', () => {
    expect(temperatureOf({ metadata: { world_temperature: { value: 61, updated_at: 't' } } })).toEqual({ value: 61, updated_at: 't' });
    expect(temperatureOf({ metadata: { world_temperature: { value: '61' } } })).toBeNull();
    expect(temperatureOf({ world_facts: { worldTemperature: 61 } })).toBeNull();
    expect(temperatureOf(null)).toBeNull();
  });
});
