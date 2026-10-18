/**
 * A Feed profile's posting schedule (services/postingSchedule; Evoni,
 * 2026-10-18): normalize, the suggestion from who they are, and the next
 * time on their schedule in her own time zone.
 */
const ps = require('../../../src/services/postingSchedule');

// Her time zone: UTC-4 (getTimezoneOffset 240). 2026-10-19 is a Monday.
const TZ = 240;
const at = (iso) => new Date(iso);

describe('normalize', () => {
  test('keeps the week order, sorts windows and clamps nothing silently', () => {
    const s = ps.normalize({ days: ['fri', 'mon', 'mon'], windows: [{ start: '18:00', end: '20:00' }, { start: '07:00', end: '09:00' }], per_week: 3, tz_offset: TZ });
    expect(s.days).toEqual(['mon', 'fri']);
    expect(s.windows.map((w) => w.start)).toEqual(['07:00', '18:00']);
    expect(s).toMatchObject({ per_week: 3, tz_offset: TZ, source: 'set' });
  });
  test('refuses what cannot be a schedule', () => {
    expect(() => ps.normalize({ days: [], windows: [{ start: '07:00', end: '09:00' }], per_week: 2 })).toThrow(/days/);
    expect(() => ps.normalize({ days: ['mon'], windows: [{ start: '7am', end: '09:00' }], per_week: 2 })).toThrow(/HH:MM/);
    expect(() => ps.normalize({ days: ['mon'], windows: [{ start: '07:00', end: '07:00' }], per_week: 2 })).toThrow(/end/);
    expect(() => ps.normalize({ days: ['mon'], windows: [{ start: '07:00', end: '09:00' }], per_week: 40 })).toThrow(/per_week/);
  });
});

describe('suggestSchedule', () => {
  test('a slow-living lurker posts a couple of mornings a week', () => {
    const { schedule, why } = ps.suggestSchedule({ society_archetype: 'The Slow Living Creator' }, { habits_json: { temperament: 'lurker' } });
    expect(schedule.windows).toEqual([{ start: '07:00', end: '09:30' }]);
    expect(schedule.days).toEqual(['tue', 'sat']);
    expect(schedule.per_week).toBe(2);
    expect(schedule.source).toBe('suggested');
    expect(why).toMatch(/Tue\/Sat mornings/);
  });
  test('a nightlife oversharer posts every evening, often', () => {
    const { schedule } = ps.suggestSchedule({ society_archetype: 'The Party Girl' }, { habits_json: { temperament: 'oversharer' } });
    expect(schedule.days).toHaveLength(7);
    expect(schedule.windows[0].start).toBe('20:00');
    expect(schedule.per_week).toBe(10);
  });
  test('business content stays on weekdays; nothing known gives midday and evening', () => {
    expect(ps.suggestSchedule({ content_category: 'finance' }, null).schedule.days).toEqual(['mon', 'wed', 'fri']);
    const plain = ps.suggestSchedule({}, null).schedule;
    expect(plain.windows.map((w) => w.start)).toEqual(['12:00', '18:00']);
    expect(plain.per_week).toBe(4);
  });
});

describe('nextSlot', () => {
  const tueThuMornings = ps.normalize({ days: ['tue', 'thu'], windows: [{ start: '07:00', end: '09:00' }], per_week: 2, tz_offset: TZ });

  test('moves a Monday noon to Tuesday 7:00 her time', () => {
    const t = ps.nextSlot(tueThuMornings, { after: at('2026-10-19T16:00:00Z') });
    expect(t.toISOString()).toBe('2026-10-20T11:00:00.000Z'); // 07:00 UTC-4
  });
  test('inside an open window it keeps the time (rounded up to 5 minutes)', () => {
    const t = ps.nextSlot(tueThuMornings, { after: at('2026-10-20T11:31:10Z') });
    expect(t.toISOString()).toBe('2026-10-20T11:35:00.000Z');
  });
  test('keeps the gap from their other posts', () => {
    const t = ps.nextSlot(tueThuMornings, { after: at('2026-10-20T11:00:00Z'), taken: [at('2026-10-20T11:00:00Z')], gapMs: 3 * 3600 * 1000 });
    expect(t.toISOString()).toBe('2026-10-22T11:00:00.000Z'); // Tuesday's window is too short; Thursday
  });
  test('a full week goes to the next week', () => {
    const taken = [at('2026-10-20T11:00:00Z'), at('2026-10-22T11:00:00Z')];
    const t = ps.nextSlot(tueThuMornings, { after: at('2026-10-21T00:00:00Z'), taken });
    expect(t.toISOString()).toBe('2026-10-27T11:00:00.000Z');
  });
  test('a window across midnight belongs to the day it starts', () => {
    const lateFri = ps.normalize({ days: ['fri'], windows: [{ start: '22:00', end: '01:00' }], per_week: 3, tz_offset: 0 });
    expect(ps.nextSlot(lateFri, { after: at('2026-10-24T00:30:00Z') }).toISOString()).toBe('2026-10-24T00:30:00.000Z'); // Sat 00:30, inside Friday's window
    expect(ps.nextSlot(lateFri, { after: at('2026-10-24T02:00:00Z') }).toISOString()).toBe('2026-10-30T22:00:00.000Z');
  });
  test('the time zone decides the day', () => {
    // 02:00 UTC Wednesday is 22:00 Tuesday at UTC-4.
    expect(ps.allowsDay(tueThuMornings, at('2026-10-21T02:00:00Z'))).toBe(true);
    expect(ps.allowsDay(tueThuMornings, at('2026-10-21T02:00:00Z'), 0)).toBe(false);
    expect(ps.weekStart(at('2026-10-21T02:00:00Z'), TZ).toISOString()).toBe('2026-10-19T04:00:00.000Z');
  });
  test('describe reads as words', () => {
    expect(ps.describe(tueThuMornings)).toBe('Tue/Thu mornings');
    expect(ps.describe(ps.normalize({ days: ['mon', 'tue', 'wed', 'thu', 'fri'], windows: [{ start: '08:00', end: '10:00' }, { start: '19:00', end: '21:00' }], per_week: 5 }))).toBe('weekdays mornings and evenings');
  });
});
