/**
 * The deal checklist and the to-do mode, beat by beat (Task 3191; Evoni,
 * 2026-10-14, phone phase 3 rulings 3 and 6).
 */
import { test, expect } from 'vitest';
import { deliverOf, deliverLine, todoModeOf, deliverCues, deliveredAt, todoModeAt, dealCueFlags } from './scriptMoments';

const DELIVERABLES = [{ id: 'd-reel' }, { id: 'd-story' }];
const BEATS = [
  { number: 7, lines: ['Lala: "A deal?"'] },
  { number: 8, lines: ['[UI:OPEN Closet]', 'Lala: "This one."'] },
  { number: 10, lines: ['Lala: "Rolling."', '[DELIVER: d-reel]', '[DELIVER: d-gone]', '[TODO_MODE: banana]'] },
  { number: 11, lines: ['[TODO_MODE: career]', '[DELIVER: d-story]'] },
];

test('a [DELIVER] line names its deliverable; a [TODO_MODE] line its mode; a picker writes one', () => {
  expect(deliverOf('[DELIVER: d-reel]')).toBe('d-reel');
  expect(deliverOf('  [deliver:   d-reel ] ')).toBe('d-reel');
  expect(deliverOf('Lala: "[DELIVER: no]"')).toBeNull();
  expect(deliverLine(' d-reel ')).toBe('[DELIVER: d-reel]');
  expect(todoModeOf('[TODO_MODE: Deal]')).toBe('deal');
  expect(todoModeOf('Lala: "Hi."')).toBeNull();
});

test("each deliverable is ticked from its line; an id that isn't the event's ticks nothing", () => {
  expect(deliverCues(BEATS, DELIVERABLES).map((c) => [c.id, Boolean(c.deliverable)])).toEqual([['d-reel', true], ['d-gone', false], ['d-story', true]]);
  expect([...deliveredAt(BEATS, 2, 0, DELIVERABLES)]).toEqual([]);
  expect([...deliveredAt(BEATS, 2, 1, DELIVERABLES)]).toEqual(['d-reel']);
  expect([...deliveredAt(BEATS, 3, Infinity, DELIVERABLES)]).toEqual(['d-reel', 'd-story']);
});

test('the mode by beat: Shopping through the closet beat, the deal at a locked deal, else Career; a beat cue wins', () => {
  const at = (i, dealLocked) => todoModeAt(BEATS, i, { closetNumber: 8, dealLocked });
  expect(at(0, true)).toEqual({ mode: 'shopping', source: 'auto' });
  expect(at(1, true)).toEqual({ mode: 'shopping', source: 'auto' });
  expect(at(2, true)).toEqual({ mode: 'deal', source: 'auto' }); // an invalid cue sets nothing
  expect(at(2, false)).toEqual({ mode: 'career', source: 'auto' });
  expect(at(3, true)).toEqual({ mode: 'career', source: 'cue' });
  expect(todoModeAt(BEATS, 0, { closetNumber: null, dealLocked: true }).mode).toBe('deal');
});

test('a deliver id not of this event and a mode that is no mode are flagged, in script order', () => {
  expect(dealCueFlags(BEATS, DELIVERABLES)).toEqual([
    { beatIndex: 2, lineIndex: 2, flag: 'not_this_event', text: '[DELIVER: d-gone] is not a deliverable of this event' },
    { beatIndex: 2, lineIndex: 3, flag: 'bad_mode', text: '[TODO_MODE: banana] is not shopping, deal or career' },
  ]);
});
