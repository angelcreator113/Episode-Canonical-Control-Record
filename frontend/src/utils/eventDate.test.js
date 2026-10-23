/**
 * formatEventDate: one formatter for event dates (stored day, free text,
 * timestamps).
 */
import { describe, test, expect } from 'vitest';
import { formatEventDate } from './eventDate';

describe('formatEventDate', () => {
  test('a stored YYYY-MM-DD is that calendar day, in every style', () => {
    expect(formatEventDate('2026-11-12')).toBe('Thu, Nov 12');
    expect(formatEventDate('2026-03-15', { style: 'monthDay' })).toBe('Mar 15');
    expect(formatEventDate('2026-03-15', { style: 'full' })).toBe('Mar 15, 2026');
  });

  test('free text is shown as stored, or null with fallback: false', () => {
    expect(formatEventDate('Friday, March 15th')).toBe('Friday, March 15th');
    expect(formatEventDate('March 15', { style: 'monthDay' })).toBe('March 15');
    expect(formatEventDate('not a date', { fallback: false })).toBeNull();
    expect(formatEventDate('2026-02-30')).toBe('2026-02-30');
  });

  test('blank is null', () => {
    expect(formatEventDate(null)).toBeNull();
    expect(formatEventDate('')).toBeNull();
    expect(formatEventDate('   ')).toBeNull();
  });

  test('a timestamp is a moment', () => {
    expect(formatEventDate('2026-09-24T12:00:00Z', { style: 'full' })).toMatch(/2026/);
    expect(formatEventDate(new Date(Date.UTC(2026, 8, 24, 12)), { style: 'full' })).toMatch(/2026/);
  });

  test('a stored day does not shift with the time zone (it is read in UTC)', () => {
    const real = Date.prototype.toLocaleDateString;
    const seen = [];
    Date.prototype.toLocaleDateString = function patched(locale, opts) { seen.push(opts?.timeZone); return real.call(this, locale, opts); };
    try {
      expect(formatEventDate('2026-03-15', { style: 'monthDay' })).toBe('Mar 15');
    } finally {
      Date.prototype.toLocaleDateString = real;
    }
    expect(seen).toEqual(['UTC']);
  });
});

describe('formatClockTime', () => {
  test('local 24-hour hours and minutes', async () => {
    const { formatClockTime } = await import('./eventDate');
    const d = new Date(2026, 9, 23, 14, 2, 59);
    expect(formatClockTime(d)).toBe('14:02');
    expect(formatClockTime(d.getTime())).toBe('14:02');
    expect(formatClockTime(String(d.getTime()))).toBe('14:02');
    expect(formatClockTime(d.toISOString())).toBe('14:02');
    expect(formatClockTime(new Date(2026, 0, 1, 0, 5))).toBe('00:05');
  });
  test('not a time: null', async () => {
    const { formatClockTime } = await import('./eventDate');
    expect(formatClockTime(null)).toBeNull();
    expect(formatClockTime('')).toBeNull();
    expect(formatClockTime('soon')).toBeNull();
  });
});
