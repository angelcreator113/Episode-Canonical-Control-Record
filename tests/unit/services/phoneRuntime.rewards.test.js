/**
 * phoneRuntime mission-reward tests.
 *
 * Rewards fire ONCE on the transition incomplete → complete. These cases lock
 * in the contract so the server-side /tap route and the client-side preview
 * can't drift in their handling.
 */

describe('applyMissionRewards', () => {
  let runtime;

  beforeEach(() => {
    jest.resetModules();
    runtime = require('../../../src/services/phoneRuntime');
  });

  const DONE = [{ key: 'done', op: 'eq', value: true }];

  function mission(overrides = {}) {
    return {
      id: 'm1',
      name: 'Finish it',
      is_active: true,
      objectives: [{ id: 'o', label: 'Do the thing', condition: DONE }],
      reward_actions: [],
      ...overrides,
    };
  }

  it('no-ops when no missions', () => {
    const out = runtime.applyMissionRewards({ missions: [], context: { state: {} } });
    expect(out.newlyCompletedIds).toEqual([]);
    expect(out.effects.toasts).toEqual([]);
  });

  it('no-ops when missions exist but none are newly complete', () => {
    const out = runtime.applyMissionRewards({
      missions: [mission({ reward_actions: [{ type: 'show_toast', text: 'Hi' }] })],
      context: { state: { done: false } },
    });
    expect(out.newlyCompletedIds).toEqual([]);
    expect(out.effects.toasts).toEqual([]);
  });

  it('fires reward actions exactly once when a mission newly completes', () => {
    const writer = { setState: jest.fn() };
    const out = runtime.applyMissionRewards({
      missions: [mission({
        reward_actions: [
          { type: 'set_state', key: 'unlocked', value: true },
          { type: 'show_toast', text: 'Nice!', tone: 'success' },
        ],
      })],
      context: { state: { done: true } },
      writer,
    });
    expect(out.newlyCompletedIds).toEqual(['m1']);
    expect(out.newlyCompletedMissions).toEqual([{ id: 'm1', name: 'Finish it' }]);
    expect(writer.setState).toHaveBeenCalledWith('unlocked', true);
    expect(out.effects.toasts).toEqual([{ text: 'Nice!', tone: 'success' }]);
  });

  it('skips missions already in prevCompletedIds (no double-fire)', () => {
    const writer = { setState: jest.fn() };
    const out = runtime.applyMissionRewards({
      missions: [mission({ reward_actions: [{ type: 'set_state', key: 'x', value: 1 }] })],
      prevCompletedIds: ['m1'],
      context: { state: { done: true } },
      writer,
    });
    expect(out.newlyCompletedIds).toEqual([]);
    expect(writer.setState).not.toHaveBeenCalled();
  });

  it('skips inactive missions even when conditions pass', () => {
    const out = runtime.applyMissionRewards({
      missions: [mission({ is_active: false, reward_actions: [{ type: 'show_toast', text: 'hi' }] })],
      context: { state: { done: true } },
    });
    expect(out.newlyCompletedIds).toEqual([]);
    expect(out.effects.toasts).toEqual([]);
  });

  it('fires multiple newly-complete missions in one pass', () => {
    const writer = { setState: jest.fn() };
    const out = runtime.applyMissionRewards({
      missions: [
        { id: 'a', name: 'A', is_active: true,
          objectives: [{ id: 'o', label: 'a', condition: [{ key: 'a', op: 'eq', value: true }] }],
          reward_actions: [{ type: 'set_state', key: 'ra', value: 1 }] },
        { id: 'b', name: 'B', is_active: true,
          objectives: [{ id: 'o', label: 'b', condition: [{ key: 'b', op: 'eq', value: true }] }],
          reward_actions: [{ type: 'set_state', key: 'rb', value: 1 }] },
      ],
      context: { state: { a: true, b: true } },
      writer,
    });
    expect(out.newlyCompletedIds).toEqual(['a', 'b']);
    expect(writer.setState).toHaveBeenCalledWith('ra', 1);
    expect(writer.setState).toHaveBeenCalledWith('rb', 1);
  });

  it('merges toasts across multiple reward action types', () => {
    const out = runtime.applyMissionRewards({
      missions: [mission({
        reward_actions: [
          { type: 'show_toast', text: 'A' },
          { type: 'show_toast', text: 'B', tone: 'success' },
        ],
      })],
      context: { state: { done: true } },
    });
    expect(out.effects.toasts.map(t => t.text)).toEqual(['A', 'B']);
  });

  it('disallowed action types in reward_actions are silently dropped (allowlist in applyActions)', () => {
    const writer = { setState: jest.fn() };
    const out = runtime.applyMissionRewards({
      missions: [mission({
        reward_actions: [
          { type: 'delete_character', target: 'lala' },  // not in allowlist
          { type: 'set_state', key: 'safe', value: true },
        ],
      })],
      context: { state: { done: true } },
      writer,
    });
    expect(out.newlyCompletedIds).toEqual(['m1']);
    expect(writer.setState).toHaveBeenCalledTimes(1);
    expect(writer.setState).toHaveBeenCalledWith('safe', true);
  });

  it('navigate reward is returned as effects.navigate', () => {
    const out = runtime.applyMissionRewards({
      missions: [mission({ reward_actions: [{ type: 'navigate', target: 'reward_screen' }] })],
      context: { state: { done: true } },
    });
    expect(out.effects.navigate).toBe('reward_screen');
  });

  it('complete_episode reward sets effects.completeEpisode', () => {
    const writer = { markEpisodeComplete: jest.fn() };
    const out = runtime.applyMissionRewards({
      missions: [mission({ reward_actions: [{ type: 'complete_episode' }] })],
      context: { state: { done: true } },
      writer,
    });
    expect(out.effects.completeEpisode).toBe(true);
    expect(writer.markEpisodeComplete).toHaveBeenCalled();
  });
});
