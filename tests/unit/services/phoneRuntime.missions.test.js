/**
 * phoneRuntime mission-evaluation tests.
 *
 * Missions are read-only observers in v1: given a mission definition and a
 * runtime context, evaluateMission returns per-objective completion + overall
 * progress. These tests lock in that contract so the frontend display and
 * server checks never drift.
 */

describe('phoneRuntime mission evaluation', () => {
  let runtime;
  let schema;

  beforeEach(() => {
    jest.resetModules();
    runtime = require('../../../src/services/phoneRuntime');
    schema = require('../../../src/services/phoneConditionSchema');
  });

  function mission(overrides = {}) {
    return {
      id: 'm1',
      name: 'Break up with the ex',
      objectives: [],
      ...overrides,
    };
  }

  describe('evaluateMission', () => {
    it('returns inactive for malformed input', () => {
      const p = runtime.evaluateMission(null, {});
      expect(p.active).toBe(false);
      expect(p.is_complete).toBe(false);
      expect(p.total).toBe(0);
    });

    it('is active with no start_condition (default)', () => {
      const m = mission({ objectives: [
        { id: 'o1', label: 'Read message', condition: [{ key: 'read_msg', op: 'eq', value: true }] },
      ]});
      const p = runtime.evaluateMission(m, { state: { read_msg: false } });
      expect(p.active).toBe(true);
      expect(p.is_complete).toBe(false);
    });

    it('is inactive when start_condition fails', () => {
      const m = mission({
        start_condition: [{ key: 'unlocked', op: 'eq', value: true }],
        objectives: [{ id: 'o1', label: 'Do thing', condition: [{ key: 'did_thing', op: 'eq', value: true }] }],
      });
      const p = runtime.evaluateMission(m, { state: { did_thing: true } });
      expect(p.active).toBe(false);
      // is_complete is false even when all objectives pass if mission isn't active
      expect(p.is_complete).toBe(false);
    });

    it('reports per-objective completion', () => {
      const m = mission({ objectives: [
        { id: 'a', label: 'A', condition: [{ key: 'a', op: 'eq', value: true }] },
        { id: 'b', label: 'B', condition: [{ key: 'b', op: 'eq', value: true }] },
        { id: 'c', label: 'C', condition: [{ key: 'c', op: 'eq', value: true }] },
      ]});
      const p = runtime.evaluateMission(m, { state: { a: true, c: true } });
      expect(p.objectives.map(o => ({ id: o.id, complete: o.complete }))).toEqual([
        { id: 'a', complete: true },
        { id: 'b', complete: false },
        { id: 'c', complete: true },
      ]);
      expect(p.completed).toBe(2);
      expect(p.total).toBe(3);
      expect(p.is_complete).toBe(false);
    });

    it('is_complete only when active AND all objectives pass', () => {
      const m = mission({ objectives: [
        { id: 'a', label: 'A', condition: [{ key: 'a', op: 'eq', value: true }] },
        { id: 'b', label: 'B', condition: [{ key: 'b', op: 'gte', value: 5 }] },
      ]});
      const p = runtime.evaluateMission(m, { state: { a: true, b: 7 } });
      expect(p.is_complete).toBe(true);
    });

    it('empty objectives never completes (avoids "0/0 = complete" footgun)', () => {
      const m = mission({ objectives: [] });
      const p = runtime.evaluateMission(m, {});
      expect(p.is_complete).toBe(false);
    });
  });

  describe('evaluateMissions (batch)', () => {
    it('returns empty array for non-array input', () => {
      expect(runtime.evaluateMissions(null, {})).toEqual([]);
      expect(runtime.evaluateMissions(undefined, {})).toEqual([]);
    });

    it('keeps mission reference alongside progress for easy rendering', () => {
      const missions = [
        mission({ id: 'm1', objectives: [{ id: 'o', label: 'x', condition: [{ key: 'x', op: 'eq', value: 1 }] }] }),
        mission({ id: 'm2', objectives: [{ id: 'o', label: 'y', condition: [{ key: 'y', op: 'eq', value: 1 }] }] }),
      ];
      const out = runtime.evaluateMissions(missions, { state: { x: 1 } });
      expect(out).toHaveLength(2);
      expect(out[0].mission.id).toBe('m1');
      expect(out[0].progress.is_complete).toBe(true);
      expect(out[1].mission.id).toBe('m2');
      expect(out[1].progress.is_complete).toBe(false);
    });
  });

  describe('validateMissionPayload (Joi)', () => {
    it('accepts a minimal valid mission', () => {
      const { error, value } = schema.validateMissionPayload({
        name: 'Test',
        objectives: [
          { id: 'o1', label: 'Do it', condition: [{ key: 'done', op: 'eq', value: true }] },
        ],
      });
      expect(error).toBeUndefined();
      expect(value.name).toBe('Test');
    });

    it('rejects missing name', () => {
      const { error } = schema.validateMissionPayload({ objectives: [] });
      expect(error).toMatch(/name/);
    });

    it('rejects objectives with bad condition grammar', () => {
      const { error } = schema.validateMissionPayload({
        name: 'Test',
        objectives: [
          { id: 'o1', label: 'X', condition: [{ key: 'BADKEY-WITH-DASH', op: 'eq', value: 1 }] },
        ],
      });
      expect(error).toBeDefined();
    });
  });
});
