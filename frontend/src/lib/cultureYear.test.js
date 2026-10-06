import { describe, test, expect } from 'vitest';
import { yearMonths, yearSummary, memoryMoments } from './cultureYear';

const CAL = [
  { id: 'c1', title: 'Velvet Season', start_datetime: '2026-11-12T00:00:00Z', location_name: 'Dazzle District' },
  { id: 'c2', title: 'Pop-up', start_datetime: '2026-11-03T00:00:00Z', is_micro_event: true, lalaverse_district: 'Echo Park' },
  { id: 'c3', title: 'No date' },
];
const LIB = [
  { id: 'e1', name: 'Wearable Experiments Studio Session', event_date: '2026-11-01', venue_name: "STUDIO BY SABLE's Studio" },
  { id: 'e2', name: 'Undated', event_date: null },
];
const AWARDS = [{ name: 'Starlight Awards', month: 'November', desc: 'The main event.' }, { name: 'Odd', month: 'Smarch' }];

describe('the Culture year helpers', () => {
  test('a month holds its calendar events, its show events by date and its awards, by day', () => {
    const months = yearMonths({ calendar: CAL, library: LIB, awards: AWARDS });
    expect(months).toHaveLength(12);
    expect(months[10].items.map((i) => [i.kind, i.day, i.title])).toEqual([
      ['library', 1, 'Wearable Experiments Studio Session'],
      ['micro', 3, 'Pop-up'],
      ['event', 12, 'Velvet Season'],
      ['award', null, 'Starlight Awards'],
    ]);
    expect(months[10].items[0].where).toBe("STUDIO BY SABLE's Studio");
    expect(months.reduce((n, m) => n + m.items.length, 0)).toBe(4);
  });

  test('a date-only show event never moves month with the time zone', () => {
    const months = yearMonths({ library: [{ id: 'x', name: 'New Year', event_date: '2027-01-01' }] });
    expect(months[0].items[0].day).toBe(1);
  });

  test('the summary counts the library, what is placed and the cultural moments', () => {
    expect(yearSummary({ calendar: CAL, library: LIB })).toEqual({ library: 2, placed: 1, cultural: 3 });
  });

  test('memory is the completed episodes\' outcomes, newest first', () => {
    const moments = memoryMoments([
      { id: 1, status: 'active', category: 'narrative', source_document: 'episode-completion', title: 'Episode 1: Pilot — SLAY Result', content: 'Episode "Pilot" completed with tier SLAY.\nEvent: Gala.', created_at: '2026-10-01T00:00:00Z' },
      { id: 2, status: 'active', category: 'narrative', source_document: 'episode-completion', title: 'Episode 2: Gala — PASS Result', content: 'x\ny', created_at: '2026-10-05T00:00:00Z' },
      { id: 3, status: 'active', category: 'narrative', source_document: 'Show Bible v3', title: 'A rule', created_at: '2026-10-06T00:00:00Z' },
    ]);
    expect(moments.map((m) => m.title)).toEqual(['Episode 2: Gala — PASS Result', 'Episode 1: Pilot — SLAY Result']);
    expect(moments[1].text).toBe('Event: Gala.');
  });
});
