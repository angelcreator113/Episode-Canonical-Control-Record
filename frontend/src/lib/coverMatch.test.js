// The must-cover matcher (Script tab audit 6, 2026-10-24): the server has
// the same code (src/utils/coverMatch.js), and the tab reads it the same.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { goalMatch, hookCovered, verbPhrase } from './coverMatch';
import { mustCover, goalTaskFor } from './episodeScript';
import { scriptHealth } from './scriptHealth';

const require = createRequire(import.meta.url);

describe('coverMatch', () => {
  test('the server has the same code', () => {
    const shared = (text) => text.slice(text.search(/^\/\/ BEGIN SHARED$/m), text.search(/^\/\/ END SHARED$/m));
    const here = readFileSync(require.resolve('./coverMatch.js'), 'utf8');
    const there = readFileSync(require.resolve('../../../src/utils/coverMatch.js'), 'utf8');
    expect(shared(here).length).toBeGreaterThan(1000);
    expect(shared(there)).toBe(shared(here));
  });
  test('a goal by its verb phrase, in the latest beat that does it, not on the list', () => {
    const goal = { label: 'Follow up with Velour' };
    expect(verbPhrase(goal.label)).toEqual(['follow', 'up']);
    const beats = [{ number: 9, lines: ['Lala: follow up with Velour'] }, { number: 4, lines: ['Lala: I will follow up with Velour.'] }, { number: 12, lines: ['Lala: "Velour! Following up, as promised."'] }];
    expect(goalMatch(beats, goal, null)?.beat).toBe(12);
    expect(goalMatch([{ number: 11, lines: ['Lala: up next, Velour. I follow.'] }], goal, null)).toBeNull();
  });
  test('the hook only in beat 14', () => {
    expect(hookCovered([{ number: 3, lines: ['Me: a second invitation arrives'] }], 'A second invitation arrives')).toBeNull();
    expect(hookCovered([{ number: 14, lines: ['Me: and then, another invitation arrived'] }], 'A second invitation arrives')).toBe(14);
  });
});

describe('mustCover with her marks', () => {
  const event = { canon_consequences: { automation: { relationship_goals: [{ slot: 'relationship_guest', label: 'Get to know Truthville' }] } } };
  const brief = { forward_hook: 'A second invitation arrives' };
  const beats = [{ number: 11, lines: ['Lala: "I get to know Truthville at last."'] }, { number: 14, lines: ['Me: bye'] }];
  test('each item has its stable mark key', () => {
    expect(mustCover({ beats, event, brief }).map((i) => i.markKey)).toEqual(['goal:relationship_guest:get-to-know-truthville', 'hook']);
  });
  test('marked covered is covered, marked not covered is not; the words decide the rest', () => {
    const marks = { hook: { covered: true, at: '2026-10-24T10:00:00Z', by: 'u1' }, 'goal:relationship_guest:get-to-know-truthville': { covered: false, at: 'x', by: 'u1' } };
    const [goal, hook] = mustCover({ beats, event, brief, marks });
    expect(goal).toMatchObject({ covered: false, beat: null, matched: 11, marked: { covered: false } });
    expect(goal.line).toBeUndefined();
    expect(hook).toMatchObject({ covered: true, beat: null, marked: { covered: true, by: 'u1' } });
    const rows = scriptHealth({ beats, cover: [goal, hook] });
    expect(rows.filter((r) => r.key.startsWith('cover')).map((r) => r.key)).toEqual(['cover-goal-0']);
  });
  test("goalTaskFor: slot and the label's words, else the slot's only task", () => {
    const tasks = [{ slot: 'relationship_guest', label: 'Get to know  truthville!' }, { slot: 'relationship_brand', label: 'Old label' }, { slot: 'relationship_brand', label: 'Another' }];
    expect(goalTaskFor(tasks, { slot: 'relationship_guest', label: 'Get to know Truthville' })).toBe(tasks[0]);
    expect(goalTaskFor([tasks[0]], { slot: 'relationship_guest', label: 'Meet Truthville' })).toBe(tasks[0]);
    expect(goalTaskFor(tasks, { slot: 'relationship_brand', label: 'Co-style' })).toBeNull();
    expect(goalTaskFor(null, { slot: 'x', label: 'y' })).toBeNull();
  });
});
