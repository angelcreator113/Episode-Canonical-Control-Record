/**
 * The merge of the three depth-field generations, one character at a time
 * (migration 20261017240000; Evoni's approved table, 2026-10-17): a value
 * fills an empty home, a different or unplaceable one is archived, the moved
 * copy is cleared, and every change is backed up first.
 */
const { mergeRow } = require('../../../src/migrations/20261017240000-merge-character-depth-fields');

const base = {
  blind_spot: null, de_blind_spot: null, time_orientation: null, de_time_orientation: null, time_orientation_v2: null,
  change_capacity: null, de_change_capacity: null, de_change_capacity_score: null, de_change_condition: null,
  de_change_witness: null, de_arc_function: null, change_capacity_v2: null, change_conditions: null, change_blocker: null,
  money_behavior_pattern: null, de_money_behavior: null, money_behavior_note: null, de_cosmology_conflict: null,
  cosmology_vs_stated_religion: null, operative_cosmology_v2: null,
};

test('a value fills an empty home and its copy is cleared', () => {
  const { set, archive, backup } = mergeRow({ ...base, de_blind_spot: 'She mistakes control for calm.', de_time_orientation: 'cyclical' });
  expect(set).toEqual({ blind_spot: 'She mistakes control for calm.', de_blind_spot: null, time_orientation: 'cyclical', de_time_orientation: null });
  expect(archive).toEqual({});
  expect(backup).toEqual({ blind_spot: null, de_blind_spot: 'She mistakes control for calm.', time_orientation: null, de_time_orientation: 'cyclical' });
});

test('a different value keeps the home and is archived; a same value just clears', () => {
  const r = mergeRow({ ...base, blind_spot: 'A', de_blind_spot: 'B', time_orientation: 'past_anchored', de_time_orientation: 'past_anchored' });
  expect(r.set).toEqual({ de_blind_spot: null, de_time_orientation: null });
  expect(r.archive).toEqual({ de_blind_spot: 'B' });
});

test("the home's old time is renamed; a v2 value with no match is archived", () => {
  const r = mergeRow({ ...base, time_orientation: 'waiting', time_orientation_v2: 'unknown' });
  expect(r.set).toEqual({ time_orientation: 'perpetual_waiter', time_orientation_v2: null });
  expect(r.archive).toEqual({ time_orientation_v2: 'unknown' });
});

test('change capacity becomes one record with the generator keys; a sentence becomes its description', () => {
  const r = mergeRow({
    ...base, change_capacity: 'She softens slowly.',
    de_change_capacity: 'highly_rigid', de_change_capacity_score: 20, de_change_condition: 'Being seen', change_conditions: 'Loss',
    change_blocker: 'Pride', de_arc_function: 'arc', change_capacity_v2: 'slow',
  });
  expect(r.set.change_capacity).toEqual({
    description: 'She softens slowly.', mobility: 'highly_rigid', score: 20, conditions_for_change: 'Being seen', blocker: 'Pride', arc_function: 'arc',
  });
  expect(r.archive).toEqual({ change_conditions: 'Loss', change_capacity_v2: 'slow' });
  for (const k of ['de_change_capacity', 'de_change_capacity_score', 'de_change_condition', 'change_conditions', 'change_blocker', 'de_arc_function', 'change_capacity_v2']) {
    expect(r.set[k]).toBeNull();
  }
});

test("the record's own old mobility takes the five", () => {
  const r = mergeRow({ ...base, change_capacity: { mobility: 'conditional', armor_type: 'polish' } });
  expect(r.set.change_capacity).toEqual({ mobility: 'conditionally_open', armor_type: 'polish' });
});

test('mapped values move (money), notes are archived, and an untouched character changes nothing', () => {
  const r = mergeRow({ ...base, money_behavior_pattern: 'spends_to_feel_powerful', money_behavior_note: 'Buys rooms.', cosmology_vs_stated_religion: 'Prays, plans.' });
  expect(r.set).toMatchObject({ de_money_behavior: 'spend_to_feel', money_behavior_pattern: null, de_cosmology_conflict: 'Prays, plans.', money_behavior_note: null });
  expect(r.archive).toEqual({ money_behavior_note: 'Buys rooms.' });
  expect(mergeRow({ ...base, blind_spot: 'kept' })).toEqual({ set: {}, archive: {}, backup: {} });
});

test('columns this database lacks are left alone', () => {
  expect(mergeRow({ de_blind_spot: 'x' })).toEqual({ set: {}, archive: {}, backup: {} });
});
