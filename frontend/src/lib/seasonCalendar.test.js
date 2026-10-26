/** lib/seasonCalendar: the Roadmap's Calendar view (round 3, 2026-10-26). */
import { describe, test, expect } from 'vitest';
import { calendarItems, monthGrid, weekList, openingMonth, stepMonth, monthLabel, monthSummary } from './seasonCalendar';

const roadmap = {
  season_number: 2,
  phases: [{ phase: 1, slots: [
    { id: 's1', slot_number: 1, episode: { id: 'ep1', title: 'Opener' }, event: { id: 'ev1', name: 'Gala' } },
    { id: 's2', slot_number: 2, episode: null, event: { id: 'ev2', name: 'Brunch' } },
    { id: 's3', slot_number: 3, episode: null, event: null },
  ] }],
};
const release = {
  state: 'active',
  seasons: [{ season_number: 2, slots: { 2: { date: '2026-11-08', source: 'schedule' }, 3: { date: '2026-11-15', source: 'preview' } } }],
  episodes: [{ episode_id: 'ep1', season_number: 2, number: 1, date: '2026-11-01', source: 'schedule', due: 'soon' }],
  slots: {},
};
const events = [{ id: 'ev1', name: 'Gala', event_date: '2026-10-30' }, { id: 'ev2', name: 'Brunch', event_date: 'the morning after' }];
const opps = [
  { id: 'o1', name: 'Velour cover', status: 'offered', response_deadline: '2026-11-03' },
  { id: 'o2', name: 'Old deal', status: 'declined', response_deadline: '2026-11-04' },
  { id: 'o3', name: 'Aura', brand_or_company: 'Aura Co', status: 'booked', shoot_date: '2026-11-10', publish_date: '2026-12-01' },
];
const arc = { season_number: 2, starts_on: '2026-10-25', ends_on: '2027-04-11' };

describe('calendarItems', () => {
  test('releases from the schedule (the slot cards\' rows), in-world dates, deadlines; in day order', () => {
    const { items, undated } = calendarItems({ release, roadmap, events, opps, arc });
    expect(items.map((i) => [i.date, i.kind, i.title])).toEqual([
      ['2026-10-25', 'deadline', 'Season 2 starts'],
      ['2026-10-30', 'event', 'Gala'],
      ['2026-11-01', 'release', 'Releases E1'],
      ['2026-11-03', 'deadline', 'Answer by: Velour cover'],
      ['2026-11-08', 'release', 'Releases E2'],
      ['2026-11-10', 'deadline', 'Shoot: Aura'],
      ['2026-11-15', 'release', 'Would release E3'],
      ['2026-12-01', 'deadline', 'Goes public: Aura'],
      ['2027-04-11', 'deadline', 'Season 2 ends'],
    ]);
    expect(items.find((i) => i.title === 'Releases E1')).toMatchObject({ tone: 'soon', slot_number: 1, detail: 'Opener' });
    expect(items.find((i) => i.title === 'Would release E3')).toMatchObject({ tone: 'preview', detail: 'Open slot' });
    // The brunch's date is in words: counted, not placed.
    expect(undated).toBe(1);
  });

  test('nothing loaded reads as nothing', () => {
    expect(calendarItems({})).toEqual({ items: [], undated: 0 });
  });
});

describe('the month', () => {
  const { items } = calendarItems({ release, roadmap, events, opps, arc });
  test('a Sunday-first grid with the days around it, each with its items', () => {
    const weeks = monthGrid({ year: 2026, month: 10 }, items, '2026-11-01');
    expect(weeks).toHaveLength(5);
    expect(weeks[0].map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
    expect(weeks[0][0]).toMatchObject({ day: 1, inMonth: true, today: true });
    expect(weeks[0][0].items.map((i) => i.title)).toEqual(['Releases E1']);
    const last = weeks[weeks.length - 1];
    expect(last[last.length - 1]).toMatchObject({ date: '2026-12-05', inMonth: false });
    // October starts on a Thursday: the grid opens on Sunday, Sep 27.
    expect(monthGrid({ year: 2026, month: 9 }, items)[0][0].date).toBe('2026-09-27');
  });

  test('the phone list: the month by week, only weeks with something', () => {
    expect(weekList({ year: 2026, month: 10 }, items).map((w) => [w.label, w.items.length])).toEqual([
      ['Week of Sun, Nov 1', 2], ['Week of Sun, Nov 8', 2], ['Week of Sun, Nov 15', 1],
    ]);
  });

  test('opens on the next thing ahead, steps across the year, and sums up', () => {
    expect(openingMonth(items, '2026-10-26')).toEqual({ year: 2026, month: 9 });
    expect(openingMonth(items, '2026-11-20')).toEqual({ year: 2026, month: 11 });
    expect(openingMonth([], '2026-10-26')).toEqual({ year: 2026, month: 9 });
    expect(stepMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(stepMonth({ year: 2027, month: 0 }, -1)).toEqual({ year: 2026, month: 11 });
    expect(monthLabel({ year: 2026, month: 10 })).toBe('November 2026');
    expect(monthSummary({ year: 2026, month: 10 }, items)).toBe('3 releases · 2 deadlines');
    expect(monthSummary({ year: 2026, month: 0 }, items)).toBe('Nothing dated this month');
  });
});
