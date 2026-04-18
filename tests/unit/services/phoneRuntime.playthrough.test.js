/**
 * phoneRuntime integration with playthrough-shaped context.
 *
 * These tests cover the contract between the evaluator and the
 * PhonePlaythroughState row shape — i.e. that a server-side context built
 * from a DB row evaluates conditions and applies actions the same way the
 * frontend preview does.
 *
 * Doesn't hit the DB; the route-handler logic is exercised elsewhere via
 * integration tests. This file locks in the evaluator ↔ state-shape contract.
 */

describe('phoneRuntime ↔ PhonePlaythroughState contract', () => {
  let runtime;

  beforeEach(() => {
    jest.resetModules();
    runtime = require('../../../src/services/phoneRuntime');
  });

  function makeStateRow(overrides = {}) {
    return {
      state_flags: {},
      visited_screens: [],
      last_screen_id: null,
      completed_at: null,
      ...overrides,
    };
  }

  function contextFromRow(row) {
    return {
      state: row.state_flags,
      visitedScreens: new Set(row.visited_screens || []),
    };
  }

  describe('state_flags drive conditions', () => {
    it('eq / neq / gte against state_flags', () => {
      const row = makeStateRow({ state_flags: { talked_to_ex: true, score: 7 } });
      const ctx = contextFromRow(row);
      expect(runtime.evaluate([{ key: 'talked_to_ex', op: 'eq', value: true }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'score', op: 'gte', value: 5 }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'score', op: 'neq', value: 10 }], ctx)).toBe(true);
    });

    it('exists / not_exists work on state_flags keys', () => {
      const row = makeStateRow({ state_flags: { has_phone: true } });
      const ctx = contextFromRow(row);
      expect(runtime.evaluate([{ key: 'has_phone', op: 'exists' }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'missing_flag', op: 'not_exists' }], ctx)).toBe(true);
    });
  });

  describe('visited_screens drive `visited:<id>` conditions', () => {
    it('true when screen id is present in the array', () => {
      const row = makeStateRow({ visited_screens: ['home', 'messages'] });
      const ctx = contextFromRow(row);
      expect(runtime.evaluate([{ key: 'visited:messages', op: 'eq', value: true }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'visited:wardrobe', op: 'eq', value: true }], ctx)).toBe(false);
    });

    it('accepts plain arrays too (no Set coercion assumption)', () => {
      const ctx = { state: {}, visitedScreens: ['home'] };
      expect(runtime.evaluate([{ key: 'visited:home', op: 'eq', value: true }], ctx)).toBe(true);
    });
  });

  describe('set_state writer mirrors what the route persists', () => {
    it('writer.setState changes mirror what would save to state_flags', () => {
      const row = makeStateRow({ state_flags: { a: 1 } });
      const nextFlags = { ...row.state_flags };
      const writer = { setState: (k, v) => { nextFlags[k] = v; } };
      runtime.applyActions([
        { type: 'set_state', key: 'b', value: true },
        { type: 'set_state', key: 'a', value: 2 },
      ], contextFromRow(row), writer);
      expect(nextFlags).toEqual({ a: 2, b: true });
    });
  });

  describe('complete_episode marks completion', () => {
    it('markEpisodeComplete is called for complete_episode action', () => {
      let completed = false;
      const writer = { markEpisodeComplete: () => { completed = true; } };
      const effects = runtime.applyActions([{ type: 'complete_episode' }], contextFromRow(makeStateRow()), writer);
      expect(completed).toBe(true);
      expect(effects.completeEpisode).toBe(true);
    });
  });

  describe('zone-visibility server-side enforcement', () => {
    // The route handler re-evaluates zone.conditions before applying actions so a
    // malicious client that tries to tap a locked zone gets 403. This test locks
    // in the evaluator contract the route depends on.
    it('locked zone evaluates to false when its gating flag is missing', () => {
      const zone = { conditions: [{ key: 'talked_to_ex', op: 'eq', value: true }] };
      const ctx = contextFromRow(makeStateRow({ state_flags: {} }));
      expect(runtime.evaluate(zone.conditions, ctx)).toBe(false);
    });

    it('unlocked zone evaluates to true once its flag is set', () => {
      const zone = { conditions: [{ key: 'talked_to_ex', op: 'eq', value: true }] };
      const ctx = contextFromRow(makeStateRow({ state_flags: { talked_to_ex: true } }));
      expect(runtime.evaluate(zone.conditions, ctx)).toBe(true);
    });
  });
});
