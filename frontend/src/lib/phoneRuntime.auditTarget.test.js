/**
 * Lala's Phone audit (Evoni, 2026-10-07): adding an action to a tap area
 * stopped it going to its target screen. Mirrors the backend test.
 */
import { test, expect } from 'vitest';
import { actionsForZone } from './phoneRuntime';

test('a zone runs its actions, then goes to its target', () => {
  expect(actionsForZone({ target: 'dms', actions: [{ type: 'show_toast', text: 'Hi' }] }))
    .toEqual([{ type: 'show_toast', text: 'Hi' }, { type: 'navigate', target: 'dms' }]);
});

test('an explicit navigate action wins over the target', () => {
  expect(actionsForZone({ target: 'dms', actions: [{ type: 'navigate', target: 'feed' }] }))
    .toEqual([{ type: 'navigate', target: 'feed' }]);
});

test('target only, and nothing', () => {
  expect(actionsForZone({ target: 'dms' })).toEqual([{ type: 'navigate', target: 'dms' }]);
  expect(actionsForZone({})).toEqual([]);
});
