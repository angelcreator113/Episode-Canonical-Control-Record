/**
 * One home for each part of a character's inner life (Evoni, 2026-10-17):
 * the Depth Engine's twins read from and save to their Inner life homes.
 */
const f = require('../../../src/services/characterDepthFields');

describe('characterDepthFields', () => {
  test('times: the five, and the old names renamed', () => {
    expect(f.TIME_ORIENTATIONS).toEqual(['past_anchored', 'future_oriented', 'present_impulsive', 'perpetual_waiter', 'cyclical']);
    expect(['future_obsessed', 'impulsive_present', 'waiting', 'future_focused', 'suspended', 'cyclical', '', 'nonsense', null].map(f.normalizeTimeOrientation))
      .toEqual(['future_oriented', 'present_impulsive', 'perpetual_waiter', 'future_oriented', 'perpetual_waiter', 'cyclical', null, null, null]);
  });

  test("change levels: the five, the generator's three renamed", () => {
    expect(['rigid', 'Conditional', 'fluid', 'cyclically_mobile', 'slow'].map(f.normalizeMobility))
      .toEqual(['highly_rigid', 'conditionally_open', 'highly_fluid', 'cyclically_mobile', null]);
  });

  test('change_capacity as a record: a sentence is its description', () => {
    expect(f.changeCapacityOf('She bends when she is seen.')).toEqual({ description: 'She bends when she is seen.' });
    expect(f.changeCapacityOf('{"mobility":"rigid"}')).toEqual({ mobility: 'rigid' });
    expect(f.changeCapacityOf(null)).toEqual({});
  });

  test('depthView reads the twins from their homes and the rest as stored', () => {
    const json = {
      blind_spot: 'She thinks control is calm.', time_orientation: 'past_anchored',
      change_capacity: { mobility: 'rigid', conditions_for_change: 'Being seen unfinished', score: 30 },
      de_blind_spot: null, de_joy_trigger: 'Unfinished fabric',
    };
    expect(f.depthView(json, ['de_blind_spot', 'de_time_orientation', 'de_change_capacity', 'de_change_condition', 'de_change_capacity_score', 'de_joy_trigger', 'de_arc_function']))
      .toEqual({
        de_blind_spot: 'She thinks control is calm.', de_time_orientation: 'past_anchored',
        de_change_capacity: 'highly_rigid', de_change_condition: 'Being seen unfinished', de_change_capacity_score: 30,
        de_joy_trigger: 'Unfinished fabric', de_arc_function: null,
      });
  });

  test('depthUpdates saves the twins in their homes, merging the change record', () => {
    const json = { change_capacity: { mobility: 'highly_rigid', armor_type: 'polish' } };
    expect(f.depthUpdates(json, {
      de_blind_spot: 'x', de_time_orientation: 'waiting', de_change_capacity_score: 40, de_arc_function: 'arc', de_change_capacity: 'fluid', de_joy_trigger: 'y',
    })).toEqual({
      blind_spot: 'x', time_orientation: 'perpetual_waiter', de_joy_trigger: 'y',
      change_capacity: { mobility: 'highly_fluid', armor_type: 'polish', score: 40, arc_function: 'arc' },
    });
    expect(f.depthUpdates({ change_capacity: { score: 5 } }, { de_change_capacity_score: '' })).toEqual({ change_capacity: null });
  });
});
