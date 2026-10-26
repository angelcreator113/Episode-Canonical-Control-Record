/**
 * Her goal on "This episode must cover" (Evoni, 2026-10-25): the episode's
 * main career goal, weighed at Beat 6 and felt at Beat 13, matched
 * leniently by a word of its name or of what it measures.
 */
import { test, expect } from 'vitest';
import { mustCover, herGoalItem, herGoalWords, beatNamesGoal } from './episodeScript';

const GOAL = { id: 'g-1', title: 'Brand Girl Era', kind: 'main', metric: 'brand_trust', how_close: 'more than halfway' };
const beats = (six, thirteen) => [
  { number: 6, lines: six },
  { number: 9, lines: ['- [ ] Brand post'] },
  { number: 13, lines: thirteen },
];

test('first on the list, with its mark key; covered only when Beat 6 weighs it and Beat 13 feels it', () => {
  const both = mustCover({ herGoal: GOAL, beats: beats(['Lala: "Is this the deal that makes the brands take me seriously?"'], ['Lala (V.O.): One partner closer. I felt it.']) });
  expect(both[0]).toMatchObject({ key: 'her-goal', markKey: 'career:g-1', label: 'Brand Girl Era', source: 'Her goal', suggested: false, weighed: true, felt: true, beat: 13, covered: true });
  expect(both[0].detail).toBe('weighed at Beat 6, felt at Beat 13');

  const sixOnly = mustCover({ herGoal: GOAL, beats: beats(['Lala: "Brands notice girls like me tonight."'], ['Lala: It went fine.']) })[0];
  expect(sixOnly).toMatchObject({ weighed: true, felt: false, beat: null, covered: false });
  expect(mustCover({ herGoal: GOAL, beats: [] })[0]).toMatchObject({ weighed: false, felt: false, covered: false });
});

test('her mark wins, under career:<id>', () => {
  const items = mustCover({ herGoal: GOAL, beats: [], marks: { 'career:g-1': { covered: true, beat: 13, at: 'now', by: 'u' } } });
  expect(items[0]).toMatchObject({ covered: true, beat: 13, marked: { covered: true } });
});

test('no goal: no item, and the rest of the list is unchanged', () => {
  expect(mustCover({ beats: [], brief: { forward_hook: 'A rival calls' } }).map((i) => i.key)).toEqual(['hook']);
  expect(herGoalItem([], null)).toBeNull();
  expect(herGoalItem([], { title: 'No id' })).toBeNull();
});

test('a suggested goal says so', () => {
  expect(herGoalItem([], { ...GOAL, kind: 'suggested' }).suggested).toBe(true);
});

test('lenient words: the name and the stat theme; Beat 6 and 13 only', () => {
  expect(herGoalWords(GOAL)).toEqual(expect.arrayContaining(['brand', 'girl', 'partner', 'deal', 'campaign']));
  expect(herGoalWords({ title: 'Starter Fund', metric: 'coins' })).toEqual(expect.arrayContaining(['starter', 'fund', 'money', 'afford']));
  const b = [{ number: 6, lines: ['Me: Can we afford this?'] }, { number: 7, lines: ['Lala: money money'] }];
  expect(beatNamesGoal(b, 6, { title: 'Starter Fund', metric: 'coins' })).toBe(true);
  expect(beatNamesGoal(b, 13, { title: 'Starter Fund', metric: 'coins' })).toBe(false);
  expect(beatNamesGoal(b, 6, GOAL)).toBe(false);
});
