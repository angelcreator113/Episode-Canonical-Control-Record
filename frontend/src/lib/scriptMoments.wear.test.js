/**
 * What Lala has put on, line by line (Task 3180; Evoni, 2026-10-14, phone
 * phase 3 ruling 1): [WEAR: id] names the piece by id; an older
 * [UI:SELECT Item <name>] is read by name, and a name matching no piece or
 * several is flagged, never guessed.
 */
import { test, expect } from 'vitest';
import { wearOf, wearLine, wearCues, wornAt, wearFlags } from './scriptMoments';

const LOOK = [
  { id: 'dress-1', name: 'Crimson Gown' },
  { id: 'shoe-1', name: 'Satin Pump' },
  { id: 'ear-1', name: 'Pearl Drop' },
  { id: 'ear-2', name: 'Pearl Drop' },
];
const BEATS = [
  { number: 7, lines: ['[UI:OPEN Closet]', '[WEAR: dress-1]', 'Lala: "This one."'] },
  { number: 8, lines: ['[UI:SELECT Item satin pump ]', '[UI:SELECT Item Pearl Drop]', '[UI:SELECT Item Velvet Hat]', '[WEAR: gone-9]', '[WEAR: dress-1]'] },
];

test('a [WEAR] line names its piece id; a picker writes one', () => {
  expect(wearOf('[WEAR: dress-1]')).toBe('dress-1');
  expect(wearOf('  [wear:   shoe-1 ]  ')).toBe('shoe-1');
  expect(wearOf('[UI:SELECT Item Gown]')).toBeNull();
  expect(wearOf('Lala: "[WEAR: no]"')).toBeNull();
  expect(wearLine(' dress-1 ')).toBe('[WEAR: dress-1]');
});

test('every cue in order: by id, by exact name, and each problem flagged', () => {
  expect(wearCues(BEATS, LOOK).map((c) => [c.beatIndex, c.lineIndex, c.via, c.piece?.id || null, c.flag])).toEqual([
    [0, 1, 'wear', 'dress-1', null],
    [1, 0, 'select', 'shoe-1', null], // case and spaces don't matter
    [1, 1, 'select', null, 'several'], // two pieces share the name
    [1, 2, 'select', null, 'no_match'],
    [1, 3, 'wear', null, 'not_in_look'],
    [1, 4, 'wear', 'dress-1', null],
  ]);
});

test('worn so far: the pieces put on at or before a line, each once, carried from beat to beat', () => {
  expect(wornAt(BEATS, 0, 0, LOOK)).toEqual([]);
  expect(wornAt(BEATS, 0, 1, LOOK).map((p) => p.id)).toEqual(['dress-1']);
  expect(wornAt(BEATS, 1, 0, LOOK).map((p) => p.id)).toEqual(['dress-1', 'shoe-1']);
  // Ambiguous, unknown and outside-the-look cues never count; a second wear of the gown isn't a new piece.
  expect(wornAt(BEATS, 1, 99, LOOK).map((p) => p.id)).toEqual(['dress-1', 'shoe-1']);
  expect(wornAt(BEATS, 5, 0, [])).toEqual([]);
});

test('the flags read in plain words', () => {
  expect(wearFlags(BEATS, LOOK)).toEqual([
    { beatIndex: 1, lineIndex: 1, flag: 'several', text: '"Pearl Drop" matches several pieces of the look; use [WEAR: id]' },
    { beatIndex: 1, lineIndex: 2, flag: 'no_match', text: '"Velvet Hat" matches no piece of the look' },
    { beatIndex: 1, lineIndex: 3, flag: 'not_in_look', text: '[WEAR: gone-9] is not a piece of the locked look' },
  ]);
});
