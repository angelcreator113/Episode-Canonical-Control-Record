/**
 * The schedule warnings' helpers (continuity PR 1; Evoni, 2026-11-13).
 */
import { describe, test, expect } from 'vitest';
import { flowWarningLines, hintLines, scheduleSentence, offsetWords, conflictLabel } from './eventSchedule';

const CLASHES = { lines: [
  { kind: 'day', field: 'date', text: 'Gallery Late is on the same day.' },
  { kind: 'guest', field: 'guests', text: 'Nia Cole is also at Gallery Late that day.' },
  { kind: 'money', field: 'money', text: 'Costs about 900 coins; Lala has 400, 500 short right now.' },
] };
const SCHEDULE = { lines: [{ kind: 'guest', field: 'guests', text: 'Nia Cole is at Gallery Late (21:00–23:00) at the same time: 1 h overlap.' }] };

describe('the page\'s warning lines', () => {
  test('a server with no schedule part: every line as it was', () => {
    expect(flowWarningLines({ clashes: CLASHES })).toEqual(CLASHES.lines);
    expect(hintLines({ clashes: CLASHES }, ['guests'])).toEqual([CLASHES.lines[1]]);
    expect(flowWarningLines(null)).toEqual([]);
  });

  test('with a schedule: its lines replace the date-only ones; money stays', () => {
    expect(flowWarningLines({ clashes: CLASHES, schedule: SCHEDULE })).toEqual([CLASHES.lines[2], SCHEDULE.lines[0]]);
    expect(hintLines({ clashes: CLASHES, schedule: SCHEDULE }, ['guests'])).toEqual([]);
    expect(hintLines({ clashes: CLASHES, schedule: SCHEDULE }, ['dress_code', 'date'])).toEqual([]);
    expect(hintLines({ clashes: CLASHES, schedule: SCHEDULE }, ['deal_type', 'money'])).toEqual([CLASHES.lines[2]]);
  });

  test('a schedule with nothing to say removes the same-day lines: the same day alone is not a clash', () => {
    expect(flowWarningLines({ clashes: CLASHES, schedule: { lines: [] } })).toEqual([CLASHES.lines[2]]);
  });
});

describe('words', () => {
  test('when it runs, with the day an overnight or multi-day event ends', () => {
    expect(scheduleSentence({ day: '2026-03-14', start_time: '19:00', end_time: '22:00', end_day: '2026-03-14', ends_another_day: false })).toBe('Sat, Mar 14 · 19:00 – 22:00');
    expect(scheduleSentence({ day: '2026-03-14', start_time: '21:00', end_time: '01:00', end_day: '2026-03-15', ends_another_day: true })).toBe('Sat, Mar 14 · 21:00 – 01:00, ends Sun, Mar 15');
    expect(scheduleSentence({ day: '2026-03-14', start_time: '10:00', end_time: '16:00', end_day: '2026-03-17', ends_another_day: true })).toBe('Sat, Mar 14 · 10:00 – 16:00, ends Tue, Mar 17');
    expect(scheduleSentence({ day: '2026-03-14', start_time: null })).toBeNull();
    expect(scheduleSentence(null)).toBeNull();
  });

  test('the offset from DREAM cities time', () => {
    expect(offsetWords(0)).toBeNull();
    expect(offsetWords(360)).toBe('+6 h from DREAM cities time');
    expect(offsetWords(-330)).toBe('−5 h 30 min from DREAM cities time');
    expect(offsetWords(45)).toBe('+45 min from DREAM cities time');
  });

  test('a conflict\'s chip', () => {
    expect(conflictLabel({ kind: 'overlap', severity: 'host' })).toBe('Host conflict');
    expect(conflictLabel({ kind: 'travel', severity: 'guest' })).toBe('Guest');
    expect(conflictLabel({ kind: 'overlap', severity: 'lala' })).toBe('Lala');
    expect(conflictLabel({ kind: 'unverified', severity: 'host' })).toBe("Can't verify");
  });
});
