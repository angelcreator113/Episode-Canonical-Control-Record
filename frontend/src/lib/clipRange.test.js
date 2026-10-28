// Where a video starts and ends (Evoni, 2026-10-28): the beats a
// full-episode take covers from its markers (beats she was moved past at
// 0:00 not counted), a picked start and end beat, overlaps between her
// takes, and where to continue from.
import { vi, describe, test, expect } from 'vitest';
import {
  realMarks, clipRange, rangeText, rangeOverlaps, overlapText, beatsText, beatNames, continueFrom, marksOf,
} from './clipRange';

// Her 8-minute take: beats 1-9 at 0:00 (moved past), then 10-14 as read.
const EIGHT_MIN_MARKS = [
  ...Array.from({ length: 9 }, (_, i) => ({ beat: i + 1, t: 0 })),
  { beat: 10, t: 9.4 }, { beat: 11, t: 10.4 }, { beat: 12, t: 162.5 }, { beat: 13, t: 239.2 }, { beat: 14, t: 399.3 },
];
const eightMin = { id: 'f8', performer: 'justawoman', label: 'Full episode · take 2', beat_marks: EIGHT_MIN_MARKS, duration_seconds: 480 };
// Her 22-minute take: beats 1-11.
const twentyTwo = { id: 'f22', performer: 'justawoman', label: 'Full episode · take 1', duration_seconds: 1320,
  beat_marks: Array.from({ length: 11 }, (_, i) => ({ beat: i + 1, t: i * 110 })) };

describe('realMarks', () => {
  test('beats at 0:00 before the first beat read are not real; the same take with no entries for them reads the same', () => {
    expect(realMarks(EIGHT_MIN_MARKS).map((m) => m.beat)).toEqual([10, 11, 12, 13, 14]);
    expect(realMarks(EIGHT_MIN_MARKS.slice(9)).map((m) => m.beat)).toEqual([10, 11, 12, 13, 14]);
  });

  test('one beat at 0:00 is where the take started (real); a jump mid-take keeps only the beat landed on', () => {
    expect(realMarks([{ beat: 1, t: 0 }, { beat: 3, t: 70.5 }]).map((m) => m.beat)).toEqual([1, 3]);
    expect(realMarks([{ beat: 5, t: 50 }, { beat: 6, t: 100 }, { beat: 7, t: 100 }, { beat: 8, t: 100 }, { beat: 9, t: 160 }]).map((m) => m.beat)).toEqual([5, 8, 9]);
    expect(realMarks(null)).toEqual([]);
    expect(marksOf({ beat_marks: '[{"beat":2,"t":3}]' })).toEqual([{ beat: 2, t: 3 }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(marksOf({ beat_marks: 'not json' })).toEqual([]);
    console.error.mockRestore();
  });
});

describe('clipRange and rangeText', () => {
  test('her 8-minute take reads "Beats 10 → 14 · ended in beat 14 · Cliffhanger"', () => {
    expect(clipRange(eightMin)).toEqual({ from: 10, to: 14, source: 'marks', last: 14 });
    expect(rangeText(eightMin)).toBe('Beats 10 → 14 · ended in beat 14 · Cliffhanger');
    expect(rangeText(twentyTwo)).toBe('Beats 1 → 11 · ended in beat 11 · The Event');
  });

  test('the beat names the episode has win over the standard ones', () => {
    const names = beatNames([{ beat_number: 14, beat_name: 'The Last Word' }]);
    expect(rangeText(eightMin, names)).toBe('Beats 10 → 14 · ended in beat 14 · The Last Word');
    expect(names(11)).toBe('The Event');
  });

  test('a picked start and end: "Beat 1 → Beat 11"; one beat, or an end before the start, says nothing more', () => {
    expect(rangeText({ id: 'u', beat_number: 1, end_beat_number: 11 })).toBe('Beat 1 → Beat 11');
    expect(clipRange({ id: 'u', beat_number: 4 })).toEqual({ from: 4, to: 4, source: 'beat' });
    expect(rangeText({ id: 'u', beat_number: 4 })).toBeNull();
    expect(rangeText({ id: 'u', beat_number: 6, end_beat_number: 3 })).toBeNull();
    expect(clipRange({ id: 'u', beat_number: null })).toBeNull();
    // A full take whose markers are not kept yet falls back to its beat (none): nothing.
    expect(rangeText({ id: 'f', label: 'Full episode · take 3' })).toBeNull();
  });
});

describe('overlaps', () => {
  test('two of her full takes covering beats 10-11 each name the other', () => {
    const o = rangeOverlaps([twentyTwo, eightMin]);
    expect(o.get('f22').map(overlapText)).toEqual(['Overlaps Full episode · take 2 on beats 10–11']);
    expect(o.get('f8').map(overlapText)).toEqual(['Overlaps Full episode · take 1 on beats 10–11']);
  });

  test('a picked range counts; another performer\'s take, one-beat clips and takes that do not meet do not', () => {
    const upload = { id: 'u', performer: 'justawoman', label: 'overlap video', beat_number: 11, end_beat_number: 14 };
    const lala = { ...eightMin, id: 'lala', performer: 'lala' };
    const single = { id: 's', performer: 'justawoman', label: 'Beat 11 · take 1', beat_number: 11 };
    const early = { id: 'e', performer: 'justawoman', label: 'Full episode · take 0', beat_marks: [{ beat: 1, t: 0 }, { beat: 2, t: 30 }] };
    const o = rangeOverlaps([twentyTwo, upload, lala, single, early]);
    expect(o.get('f22').map(overlapText)).toEqual(['Overlaps overlap video on beat 11', 'Overlaps Full episode · take 0 on beats 1–2']);
    expect(o.get('u').map(overlapText)).toEqual(['Overlaps Full episode · take 1 on beat 11']);
    expect(o.has('lala')).toBe(false);
    expect(o.has('s')).toBe(false);
  });

  test('beatsText', () => {
    expect(beatsText([11])).toBe('beat 11');
    expect(beatsText([11, 10])).toBe('beats 10–11');
    expect(beatsText([3, 5, 6])).toBe('beats 3, 5–6');
  });
});

describe('continueFrom', () => {
  test('the latest full take stopped at beat 11: continue from beat 12', () => {
    const at = (c, iso) => ({ ...c, created_at: iso });
    const c = continueFrom([at(eightMin, '2026-10-27T10:00:00Z'), at(twentyTwo, '2026-10-28T10:00:00Z')]);
    expect(c).toMatchObject({ ended: 11, next: 12 });
    expect(c.take.id).toBe('f22');
  });

  test('a latest take that reached beat 14, or no take with markers: nothing to continue', () => {
    expect(continueFrom([twentyTwo, eightMin])).toBeNull();
    expect(continueFrom([{ id: 'x', label: 'Full episode · take 1' }])).toBeNull();
    expect(continueFrom([])).toBeNull();
    expect(continueFrom([twentyTwo], 11)).toBeNull();
  });
});
