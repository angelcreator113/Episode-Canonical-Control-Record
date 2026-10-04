/**
 * worldTemperatureService keeps world_facts a list and records the
 * temperature in metadata.world_temperature (review item 8, 2026-10-04).
 * Until then snapshotTemperature wrote { worldTemperature,
 * temperatureUpdatedAt } into world_facts, which every other reader
 * treats as a list, and computeTrajectory read a number off that list.
 */
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: jest.fn() } }; }, { virtual: true });

const { snapshotTemperature, computeTrajectory } = require('../../../src/services/worldTemperatureService');

describe('snapshotTemperature', () => {
  test('carries the latest facts and threads forward and records the temperature in metadata', async () => {
    const existing = {
      world_facts: ['Lala moved to Velvet City', { fact: 'The gala happened' }],
      active_threads: [{ id: 't1', name: 'Rivalry' }],
      metadata: { note: 'kept' },
    };
    const WorldStateSnapshot = { findOne: jest.fn(async () => existing), create: jest.fn(async (row) => row) };
    await snapshotTemperature('u1', 61, { WorldStateSnapshot });
    const row = WorldStateSnapshot.create.mock.calls[0][0];
    expect(row.snapshot_label).toBe('temperature_update');
    expect(row.universe_id).toBe('u1');
    expect(row.world_facts).toEqual(['Lala moved to Velvet City', 'The gala happened']);
    expect(row.active_threads).toEqual(existing.active_threads);
    expect(row.metadata.note).toBe('kept');
    expect(row.metadata.world_temperature.value).toBe(61);
    expect(typeof row.metadata.world_temperature.updated_at).toBe('string');
    expect(Array.isArray(row.world_facts)).toBe(true);
  });

  test('with no earlier snapshot the facts are an empty list, not an object', async () => {
    const WorldStateSnapshot = { findOne: jest.fn(async () => null), create: jest.fn(async (row) => row) };
    await snapshotTemperature('u1', 40, { WorldStateSnapshot });
    const row = WorldStateSnapshot.create.mock.calls[0][0];
    expect(row.world_facts).toEqual([]);
    expect(row.metadata).toEqual({ world_temperature: expect.objectContaining({ value: 40 }) });
  });
});

describe('computeTrajectory', () => {
  test('reads the previous temperature from metadata, never from world_facts', () => {
    expect(computeTrajectory(70, { metadata: { world_temperature: { value: 50 } } })).toBe('RISING_FAST');
    expect(computeTrajectory(56, { metadata: { world_temperature: { value: 50 } } })).toBe('RISING');
    expect(computeTrajectory(30, { metadata: { world_temperature: { value: 50 } } })).toBe('FALLING_FAST');
    expect(computeTrajectory(50, { world_facts: { worldTemperature: 20 } })).toBe('STABLE');
    expect(computeTrajectory(50, { world_facts: ['a fact'] })).toBe('STABLE');
    expect(computeTrajectory(50, null)).toBe('STABLE');
  });
});
