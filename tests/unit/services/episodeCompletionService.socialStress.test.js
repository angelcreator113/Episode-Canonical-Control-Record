/**
 * The completion stress rule counts a required social task only when it
 * traces to an accepted required deliverable (ruling, Evoni, 2026-09-29;
 * T1 §8(bb); Task #2292). A legacy or template task whose only basis is
 * required: true does not change Lala's stress.
 */
const { computeSocialTaskBonuses } = require('../../../src/services/episodeCompletionService');

const legacy = (slot, completed) => ({ slot, required: true, completed });
const deliverable = (slot, completed, extra = {}) => ({
  slot, required: true, completed, deliverable_id: `d-${slot}`, task_source: 'deliverable', ...extra,
});
const optional = (slot, completed) => ({ slot, required: false, completed });

describe('computeSocialTaskBonuses: required means a deliverable', () => {
  test('an undone legacy required: true task adds no stress', () => {
    const r = computeSocialTaskBonuses([legacy('brand_post_1', false), legacy('grwm', false), optional('go_live', true)]);
    expect(r.deltas.stress).toBeUndefined();
    expect(r.detail).toMatchObject({ required_total: 0, required_done: 0, all_required_done: false });
  });

  test('an undone deliverable task adds +1 stress', () => {
    const r = computeSocialTaskBonuses([deliverable('reel', false), legacy('grwm', true), optional('go_live', true)]);
    expect(r.deltas.stress).toBe(1);
    expect(r.detail).toMatchObject({ required_total: 1, required_done: 0 });
  });

  test('a done deliverable task counts as all required done; legacy flags do not block it', () => {
    const r = computeSocialTaskBonuses([deliverable('reel', true), legacy('grwm', false), optional('go_live', true)]);
    expect(r.detail).toMatchObject({ required_total: 1, required_done: 1, all_required_done: true });
    expect(r.deltas.stress).toBeUndefined();
    expect(r.deltas.influence).toBe(1);
  });

  test('a deliverable the terms mark optional is not required', () => {
    const r = computeSocialTaskBonuses([deliverable('reel', false, { required: false }), optional('go_live', true)]);
    expect(r.deltas.stress).toBeUndefined();
    expect(r.detail.required_total).toBe(0);
  });

  test('legacy tasks still count toward completion', () => {
    const r = computeSocialTaskBonuses([legacy('a', true), legacy('b', true), legacy('c', true), legacy('d', true), legacy('e', false)]);
    expect(r.detail).toMatchObject({ completed: 4, total: 5, completion_rate: 80 });
    expect(r.deltas.reputation).toBe(1);
  });
});
