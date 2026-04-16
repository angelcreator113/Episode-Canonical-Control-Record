/**
 * phoneRuntime Unit Tests
 *
 * The evaluator is the center of the phone feature — if this file is green, the
 * editor preview, player runtime, AI proposals, mission progress, and content
 * filtering all behave the same. Treat these cases as the contract.
 */

describe('phoneRuntime', () => {
  let runtime;
  let schema;

  beforeEach(() => {
    jest.resetModules();
    runtime = require('../../../src/services/phoneRuntime');
    schema = require('../../../src/services/phoneConditionSchema');
  });

  describe('evaluate (flat conditions, ANDed)', () => {
    it('returns true when no conditions provided (implicit default: visible)', () => {
      expect(runtime.evaluate(undefined, {})).toBe(true);
      expect(runtime.evaluate([], {})).toBe(true);
      expect(runtime.evaluate(null, {})).toBe(true);
    });

    it('ANDs multiple conditions together', () => {
      const conds = [
        { key: 'has_phone', op: 'eq', value: true },
        { key: 'beat_number', op: 'gte', value: 3 },
      ];
      expect(runtime.evaluate(conds, { state: { has_phone: true }, beatNumber: 3 })).toBe(true);
      expect(runtime.evaluate(conds, { state: { has_phone: true }, beatNumber: 2 })).toBe(false);
      expect(runtime.evaluate(conds, { state: { has_phone: false }, beatNumber: 5 })).toBe(false);
    });

    it('supports all comparison operators', () => {
      const ctx = { state: { score: 10 } };
      expect(runtime.evaluate([{ key: 'score', op: 'eq', value: 10 }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'score', op: 'neq', value: 5 }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'score', op: 'gt', value: 5 }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'score', op: 'gte', value: 10 }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'score', op: 'lt', value: 20 }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'score', op: 'lte', value: 10 }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'score', op: 'exists' }], ctx)).toBe(true);
      expect(runtime.evaluate([{ key: 'missing', op: 'not_exists' }], ctx)).toBe(true);
    });

    it('fails closed on unknown operators', () => {
      const conds = [{ key: 'x', op: 'pwn', value: 1 }];
      expect(runtime.evaluate(conds, { state: { x: 1 } })).toBe(false);
    });

    it('resolves beat_number from context', () => {
      const c = [{ key: 'beat_number', op: 'gte', value: 2 }];
      expect(runtime.evaluate(c, { beatNumber: 3 })).toBe(true);
      expect(runtime.evaluate(c, { episodeBeat: 3 })).toBe(true);  // alias
      expect(runtime.evaluate(c, { beatNumber: 1 })).toBe(false);
    });

    it('resolves visited:<screen> from visitedScreens Set or Array', () => {
      const c = [{ key: 'visited:home', op: 'eq', value: true }];
      expect(runtime.evaluate(c, { visitedScreens: new Set(['home']) })).toBe(true);
      expect(runtime.evaluate(c, { visitedScreens: ['home', 'msg'] })).toBe(true);
      expect(runtime.evaluate(c, { visitedScreens: new Set() })).toBe(false);
    });

    it('returns false on malformed (non-array) conditions', () => {
      expect(runtime.evaluate({ key: 'x' }, {})).toBe(false);
    });
  });

  describe('applyActions', () => {
    it('returns empty effects for no actions', () => {
      expect(runtime.applyActions(undefined, {}, {})).toEqual({
        navigate: null, toasts: [], completeEpisode: false,
      });
      expect(runtime.applyActions([], {}, {})).toEqual({
        navigate: null, toasts: [], completeEpisode: false,
      });
    });

    it('collects navigate, toasts, and complete_episode effects', () => {
      const actions = [
        { type: 'show_toast', text: 'Got it', tone: 'success' },
        { type: 'navigate', target: 'messages' },
        { type: 'complete_episode' },
      ];
      const effects = runtime.applyActions(actions, {}, {});
      expect(effects.navigate).toBe('messages');
      expect(effects.toasts).toEqual([{ text: 'Got it', tone: 'success' }]);
      expect(effects.completeEpisode).toBe(true);
    });

    it('calls writer.setState for set_state actions', () => {
      const writer = { setState: jest.fn() };
      runtime.applyActions([{ type: 'set_state', key: 'k', value: 1 }], {}, writer);
      expect(writer.setState).toHaveBeenCalledWith('k', 1);
    });

    it('skips action types not in the allowlist', () => {
      const writer = { setState: jest.fn() };
      const effects = runtime.applyActions(
        [{ type: 'delete_character', target: 'lala' }, { type: 'navigate', target: 'home' }],
        {}, writer
      );
      expect(effects.navigate).toBe('home');  // legit action still applied
      expect(writer.setState).not.toHaveBeenCalled();
    });
  });

  describe('actionsForZone (implicit navigate default)', () => {
    it('returns the explicit actions when present', () => {
      const zone = { target: 'ignored', actions: [{ type: 'show_toast', text: 'Hi' }] };
      expect(runtime.actionsForZone(zone)).toEqual([{ type: 'show_toast', text: 'Hi' }]);
    });

    it('synthesizes navigate action when only target is set (legacy behavior)', () => {
      const zone = { target: 'home' };
      expect(runtime.actionsForZone(zone)).toEqual([{ type: 'navigate', target: 'home' }]);
    });

    it('returns empty array when nothing is set', () => {
      expect(runtime.actionsForZone({})).toEqual([]);
    });
  });

  describe('filterZones', () => {
    it('splits zones into visible and locked per conditions', () => {
      const zones = [
        { id: 'a' },                                                          // no conds → visible
        { id: 'b', conditions: [{ key: 'has_phone', op: 'eq', value: true }] },
        { id: 'c', conditions: [{ key: 'has_phone', op: 'eq', value: false }] },
      ];
      const { visible, locked } = runtime.filterZones(zones, { state: { has_phone: true } });
      expect(visible.map(z => z.id)).toEqual(['a', 'b']);
      expect(locked.map(z => z.id)).toEqual(['c']);
    });
  });
});

describe('phoneConditionSchema', () => {
  let schema;
  beforeEach(() => { schema = require('../../../src/services/phoneConditionSchema'); });

  describe('validateScreenLinks', () => {
    it('accepts zones with no conditions or actions (existing zones keep working)', () => {
      const zones = [{ id: 'z1', x: 10, y: 20, w: 30, h: 40, target: 'home' }];
      const { error, value } = schema.validateScreenLinks(zones);
      expect(error).toBeUndefined();
      expect(value).toEqual(zones);
    });

    it('accepts valid flat conditions + actions', () => {
      const zones = [{
        id: 'z1',
        conditions: [{ key: 'unlocked', op: 'eq', value: true }],
        actions: [
          { type: 'navigate', target: 'home' },
          { type: 'set_state', key: 'tapped', value: true },
        ],
      }];
      const { error } = schema.validateScreenLinks(zones);
      expect(error).toBeUndefined();
    });

    it('rejects action types not in the allowlist', () => {
      const zones = [{
        id: 'z1',
        actions: [{ type: 'delete_character', target: 'lala' }],
      }];
      const { error } = schema.validateScreenLinks(zones);
      expect(error).toMatch(/allowlist|invalid/i);
    });

    it('rejects malformed conditions (missing op)', () => {
      const zones = [{ id: 'z1', conditions: [{ key: 'x', value: 1 }] }];
      const { error } = schema.validateScreenLinks(zones);
      expect(error).toBeDefined();
    });

    it('rejects invalid condition keys (uppercase, symbols)', () => {
      const zones = [{ id: 'z1', conditions: [{ key: 'HAS-DASH', op: 'eq', value: 1 }] }];
      const { error } = schema.validateScreenLinks(zones);
      expect(error).toBeDefined();
    });
  });
});
