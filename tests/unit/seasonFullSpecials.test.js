/**
 * Automatic specials when the season is full (Evoni, 2026-10-26): the pure
 * rules of services/seasonFullSpecials — what "full" is, where a special
 * goes in story order, and which weekly episode a swap suggests.
 */
const { seasonFull, storyPosition, nearestSwap, isoDay } = require('../../src/services/seasonFullSpecials');

const slots24 = (fill = () => ({ live_event_id: 'e' })) => Array.from({ length: 24 }, (_, i) => ({ slot_number: i + 1, ...fill(i + 1) }));

describe('seasonFull: every weekly slot has an event placed or an episode started', () => {
  test('24 pencilled slots are full; started ones count too', () => {
    expect(seasonFull(slots24())).toBe(true);
    expect(seasonFull(slots24((n) => (n === 3 ? { live_episode_id: 'ep' } : { live_event_id: `e${n}` })))).toBe(true);
  });
  test('a slot with no event is open, even with a purpose', () => {
    expect(seasonFull(slots24((n) => (n === 9 ? { story_purpose: 'Her first gala' } : { live_event_id: `e${n}` })))).toBe(false);
  });
  test('roadmap views (event / episode objects) read the same; no slots is not full', () => {
    expect(seasonFull(slots24(() => ({ event: { id: 'x' } })))).toBe(true);
    expect(seasonFull([])).toBe(false);
    expect(seasonFull(null)).toBe(false);
  });
});

describe('storyPosition: after the episode whose event is just before it', () => {
  const dated = [
    { slot_number: 3, date: '2026-03-01' },
    { slot_number: 4, date: '2026-03-08' },
    { slot_number: 5, date: '2026-03-15' },
    { slot_number: 6, date: '2026-03-15' },
  ];
  test('between E4 and E5 by its date', () => {
    expect(storyPosition({ dated, eventDate: '2026-03-10' })).toEqual({ after: 4, by: 'date', skipped: 0 });
  });
  test('a tie goes after the later slot (a two-parter: after Part 2)', () => {
    expect(storyPosition({ dated, eventDate: '2026-03-15' }).after).toBe(6);
  });
  test('before every dated event: before E1', () => {
    expect(storyPosition({ dated, eventDate: '2026-01-01' }).after).toBe(0);
  });
  test('a free-text date is no date: after the last episode of the part in progress', () => {
    expect(storyPosition({ dated, eventDate: 'Friday, March 15th', partEnd: 16 })).toEqual({ after: 16, by: 'no_date', skipped: 0 });
  });
  test('a gap whose later Sunday is released is passed for the first unreleased one', () => {
    expect(storyPosition({ dated, eventDate: '2026-03-10', released: new Set([1, 2, 3, 4, 5, 6]) })).toEqual({ after: 6, by: 'date', skipped: 2 });
  });
  test('never past the last weekly episode', () => {
    expect(storyPosition({ dated, eventDate: '2026-03-10', released: new Set(Array.from({ length: 24 }, (_, i) => i + 1)), slotCount: 24 }).after).toBe(24);
  });
});

describe('nearestSwap: the weekly episode whose event date is nearest', () => {
  const options = [
    { slot_number: 4, can_swap: false, event: { date: '2026-03-09' } },
    { slot_number: 5, can_swap: true, event: { date: '2026-03-15' } },
    { slot_number: 6, can_swap: true, event: { date: '2026-03-02' } },
    { slot_number: 7, can_swap: true, event: null },
  ];
  test('a started slot is never suggested', () => {
    expect(nearestSwap(options, '2026-03-10').slot_number).toBe(5);
  });
  test('no date: no suggestion', () => {
    expect(nearestSwap(options, null)).toBeNull();
  });
});

test('isoDay reads a date only when it is one', () => {
  expect(isoDay('2026-03-10')).toBe('2026-03-10');
  expect(isoDay('2026-03-10T09:00')).toBe('2026-03-10');
  expect(isoDay('2026-02-30')).toBeNull();
  expect(isoDay('Tonight at 9pm')).toBeNull();
});
