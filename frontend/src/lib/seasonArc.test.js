import { describe, test, expect } from 'vitest';
import { shortSlotLabel, slotTitle, slotThreads, defaultSlotId, arcSummary } from './seasonArc';

const slot = (n, extra = {}) => ({ id: `s${n}`, slot_number: n, label: `S1 · E${n}`, state: 'needs_event', intention: {}, ...extra });

describe('Season Arc helpers', () => {
  test('a tile shows its episode number', () => {
    expect(shortSlotLabel(slot(7))).toBe('E7');
  });

  test('a slot holds its episode, else its event, else its idea, else nothing', () => {
    expect(slotTitle(slot(1, { episode: { title: 'Gala' }, event: { name: 'Rooftop' } }))).toBe('Gala');
    expect(slotTitle(slot(1, { event: { name: 'Rooftop' }, intention: { story_purpose: 'She bluffs' } }))).toBe('Rooftop');
    expect(slotTitle(slot(1, { intention: { story_purpose: 'She bluffs' } }))).toBe('She bluffs');
    expect(slotTitle(slot(1))).toBeNull();
  });

  test('the threads a slot moves, once each, purposes first', () => {
    const a = { id: 't1', title: 'Her mother' };
    const b = { id: 't2', title: 'The rival' };
    const s = slot(1, { intention: {
      story_thread: b,
      story_purposes: [{ text: 'x', story_thread: a }, { text: 'y', story_thread: null }, { text: 'z', story_thread: a }],
    } });
    expect(slotThreads(s)).toEqual([a, b]);
    expect(slotThreads(slot(2))).toEqual([]);
  });

  test('the slot in production opens first, else the next open one, else the first', () => {
    const phases = (slots) => [{ phase: 1, slots }];
    expect(defaultSlotId({ phases: phases([slot(1), slot(2, { state: 'in_production' })]), next_slot_number: 1 })).toBe('s2');
    expect(defaultSlotId({ phases: phases([slot(1), slot(2)]), next_slot_number: 2 })).toBe('s2');
    expect(defaultSlotId({ phases: phases([slot(1), slot(2)]), next_slot_number: null })).toBe('s1');
    expect(defaultSlotId({ phases: [] })).toBeNull();
  });

  test('the summary counts production, pencilled and slots; done only when there are any', () => {
    expect(arcSummary({ slot_count: 24, counts: { in_production: 1, event_ready: 3, needs_event: 20 } })).toBe('1 in production · 3 pencilled · 24 slots');
    expect(arcSummary({ slot_count: 24, counts: { done: 2, in_production: 0, event_ready: 0 } })).toBe('2 done · 0 in production · 0 pencilled · 24 slots');
  });
});
