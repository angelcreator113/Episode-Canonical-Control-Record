/**
 * phoneDeadLinks (phone round step 1, D1): links to a screen the phone
 * doesn't have, as the Hub's health check and a screen delete read them.
 */
import { describe, test, expect } from 'vitest';
import { deadNavigateZones, missionScreenIssues, stripScreenFromLinks } from './phoneDeadLinks';

const keys = new Set(['home', 'closet']);

describe('deadNavigateZones', () => {
  test('a Go to action to a missing screen is dead even when the target is fine', () => {
    const links = [
      { id: 'a', target: 'closet', actions: [{ type: 'navigate', target: 'dms' }] },
      { id: 'b', target: 'closet', actions: [{ type: 'navigate', target: 'home' }] },
      { id: 'c', target: 'gone' },
      { id: 'd', actions: [{ type: 'set_state', key: 'x', value: 1 }] },
    ];
    expect(deadNavigateZones(links, keys).map((z) => z.id)).toEqual(['a']);
    expect(deadNavigateZones(null, keys)).toEqual([]);
  });
});

describe('missionScreenIssues', () => {
  test('names rewards, objectives and start conditions that need a missing screen', () => {
    const out = missionScreenIssues([
      { id: 'm1', objectives: [{ label: 'Open DMs', condition: [{ key: 'visited:dms', op: 'eq', value: true }] }], reward_actions: [{ type: 'navigate', target: 'dms' }], start_condition: [{ key: 'visited:attic' }] },
      { id: 'm2', objectives: [{ label: 'Home', condition: [{ key: 'visited:home' }, { key: 'dressed' }] }], reward_actions: [{ type: 'navigate', target: 'closet' }] },
    ], keys);
    expect(out).toEqual([{ mission: expect.objectContaining({ id: 'm1' }), rewards: ['dms'], objectives: [{ label: 'Open DMs', key: 'dms' }], start: ['attic'] }]);
  });
});

describe('stripScreenFromLinks', () => {
  test('drops zones to it and Go to actions to it; a zone left with nothing goes', () => {
    const keep = { id: 'k', target: 'home' };
    const out = stripScreenFromLinks([
      { id: 't', target: 'dms' },
      { id: 'a', target: 'closet', actions: [{ type: 'set_state', key: 'x', value: 1 }, { type: 'navigate', target: 'dms' }] },
      { id: 'o', actions: [{ type: 'navigate', target: 'dms' }] },
      keep,
    ], 'dms');
    expect(out).toEqual([{ id: 'a', target: 'closet', actions: [{ type: 'set_state', key: 'x', value: 1 }] }, keep]);
    expect(out[1]).toBe(keep);
  });
});
