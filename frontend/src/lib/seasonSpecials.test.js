/**
 * Special episodes on the Season page (lib/seasonSpecials; Evoni,
 * 2026-10-26): the codes, the two-parter offer, the plain-logic bonus
 * suggestion, and how the calendar, the one-pager, the health line, the
 * Events views and the release lines show specials.
 */
import { describe, test, expect } from 'vitest';
import {
  slotCode, canMakeTwoParter, bonusSuggestions, nearestWednesday, specialTagOf, afterOptions, specialsAfter, specialWhen,
} from './seasonSpecials';
import { calendarItems } from './seasonCalendar';
import { seasonPlanSheet } from './seasonPlanSheet';
import { seasonHealth } from './seasonHealth';
import { seasonEventViews } from './eventLibrary';
import { deadlineWarning, nextReleaseOf, releaseLabel } from './releaseSchedule';

const slot = (n, over = {}) => ({ id: `s${n}`, slot_number: n, phase: Math.ceil(n / 8), state: 'needs_event', locked: false, episode: null, event: null, two_part: null, intention: {}, ...over });
const slotsWith = (over = {}) => Array.from({ length: 24 }, (_, i) => slot(i + 1, over[i + 1] || {}));
const roadmapOf = (slots, extra = {}) => ({
  season_number: 1,
  arc: { current_phase: 1 },
  specials_ready: true,
  phases: [1, 2, 3].map((p) => ({ phase: p, title: `Part ${p}`, episode_start: p * 8 - 7, episode_end: p * 8, slots: slots.filter((s) => s.phase === p) })),
  available_events: [],
  specials: [],
  two_parters: [],
  ...extra,
});
// Sundays from Nov 1: E7 Dec 13, E8 Dec 20.
const sundays = Object.fromEntries(Array.from({ length: 24 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 10, 1 + i * 7));
  return [String(i + 1), { date: d.toISOString().slice(0, 10), time: '10:00', source: 'schedule' }];
}));
const release = (extra = {}) => ({ state: 'active', schedule: { day: 'sun', time: '10:00' }, slots: sundays, seasons: [{ season_number: 1, slots: sundays }], episodes: [], specials: [], ...extra });
const BONUS = { id: 'sp1', kind: 'bonus', label: 'Special · after E7', title: 'Midweek Rooftop', after_slot_number: 7, phase: 1, state: 'event_ready', event: { id: 'ev9', name: 'Midweek Rooftop' }, episode: null, release: { date: '2026-12-16', time: '18:00' } };
const HOLIDAY = { id: 'sp2', kind: 'special', special_type: 'holiday', label: 'Holiday special', title: 'Holiday at the Penthouse', place: 'after E12', after_slot_number: 12, phase: null, state: 'needs_event', event: null, episode: null, release: { date: null, time: null } };

describe('codes and offers', () => {
  test('a slot reads E12, or E12 · Part 1/2 in a two-parter', () => {
    expect(slotCode(slot(12))).toBe('E12');
    expect(slotCode(slot(12, { two_part: { part: 1, of: 2, label: 'E12 · Part 1/2' } }))).toBe('E12 · Part 1/2');
  });
  test('"Make it a two-parter" needs an event and an open next slot, after the migration', () => {
    const ev = { id: 'g', name: 'Gala' };
    const map = roadmapOf(slotsWith({ 12: { event: ev, state: 'event_ready' }, 15: { event: ev }, 16: { event: { id: 'x' } } }));
    expect(canMakeTwoParter(map, map.phases[1].slots[3])).toBe(true); // E12, E13 open
    expect(canMakeTwoParter(map, map.phases[1].slots[6])).toBe(false); // E15, E16 has another event
    expect(canMakeTwoParter(map, slot(3))).toBe(false); // no event
    expect(canMakeTwoParter({ ...map, specials_ready: false }, map.phases[1].slots[3])).toBe(false);
    expect(canMakeTwoParter(map, { ...map.phases[1].slots[3], state: 'done' })).toBe(false);
  });
  test('after which episode: before E1, then each weekly episode', () => {
    const opts = afterOptions(roadmapOf(slotsWith()));
    expect(opts[0]).toEqual({ value: 0, label: 'Before E1' });
    expect(opts[7]).toEqual({ value: 7, label: 'After E7' });
    expect(opts).toHaveLength(25);
  });
  test('specials sit after the episode they follow; a special reads its own day', () => {
    const map = roadmapOf(slotsWith(), { specials: [BONUS, HOLIDAY] });
    expect(specialsAfter(map, 7).map((s) => s.id)).toEqual(['sp1']);
    expect(specialWhen(null, BONUS)).toEqual({ text: 'Wed, Dec 16 · 6:00 PM', set: true });
    expect(specialWhen(null, HOLIDAY)).toEqual({ text: 'No date yet', set: false });
  });
  test('an episode\'s tag from its snapshot', () => {
    expect(specialTagOf({ season_context: { special: { label: 'Special · after E7' } } })).toBe('Special · after E7');
    expect(specialTagOf({ season_context: JSON.stringify({ two_part: { part: 2, of: 2 } }) })).toBe('Part 2/2');
    expect(specialTagOf({ season_context: { label: 'S1 · E3' } })).toBeNull();
  });
});

describe('the bonus suggestion (plain logic)', () => {
  test('the nearest Wednesday', () => {
    expect(nearestWednesday('2026-12-17')).toBe('2026-12-16');
    expect(nearestWednesday('2026-12-14')).toBe('2026-12-16');
    expect(nearestWednesday('2026-12-16')).toBe('2026-12-16');
  });
  test('a high-stakes event with no Sunday near its date is suggested, after the episode before it', () => {
    const ev = { id: 'ev1', name: 'The Rooftop Gala', event_date: '2026-12-16', prestige: 9 };
    const map = roadmapOf(slotsWith({ 8: { event: { id: 'ev1', name: 'The Rooftop Gala' }, state: 'event_ready' } }));
    const [s] = bonusSuggestions({ roadmap: map, events: [ev], release: release() });
    expect(s).toMatchObject({ after: 7, date: '2026-12-16', slot: { slot_number: 8 } });
    expect(s.reason).toBe('"The Rooftop Gala" is on Wed, Dec 16: no weekly release is near it (the nearest is 3 days away), and its stakes are high (prestige 9).');
  });
  test('an unplaced event the season could take; High or Peak pressure counts as high stakes', () => {
    const ev = { id: 'ev2', name: 'Pop-up', event_date: '2026-11-25', prestige: 4 };
    const map = roadmapOf(slotsWith({ 5: { event: { id: 'ev2' }, intention: { desired_pressure: 'Peak' } } }));
    expect(bonusSuggestions({ roadmap: map, events: [ev], release: release() })[0].reason).toMatch(/Peak pressure/);
    const free = roadmapOf(slotsWith(), { available_events: [{ id: 'ev3' }] });
    expect(bonusSuggestions({ roadmap: free, events: [{ id: 'ev3', name: 'Free', event_date: '2026-11-25', prestige: 8 }], release: release() })).toHaveLength(1);
  });
  test('nothing for a low-stakes event, one near a Sunday, one dismissed, one already special, or before the migration', () => {
    const map = roadmapOf(slotsWith(), { available_events: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] , specials: [{ ...BONUS, event: { id: 'd' } }] });
    const events = [
      { id: 'a', name: 'Low', event_date: '2026-12-16', prestige: 5 },
      { id: 'b', name: 'Near', event_date: '2026-12-14', prestige: 9 },
      { id: 'c', name: 'Dismissed', event_date: '2026-12-16', prestige: 9 },
      { id: 'd', name: 'Taken', event_date: '2026-12-16', prestige: 9 },
    ];
    expect(bonusSuggestions({ roadmap: map, events, release: release(), dismissed: ['c'] })).toEqual([]);
    expect(bonusSuggestions({ roadmap: { ...map, specials_ready: false }, events: [{ ...events[2] }], release: release() })).toEqual([]);
  });
});

describe('specials on the calendar, the one-pager, the health line, the Events views and the release lines', () => {
  const map = roadmapOf(slotsWith({ 12: { two_part: { part: 1, of: 2, other_slot_number: 13, label: 'E12 · Part 1/2' }, event: { id: 'g', name: 'Gala' } }, 13: { two_part: { part: 2, of: 2, other_slot_number: 12, label: 'E13 · Part 2/2' }, event: { id: 'g', name: 'Gala' } } }),
    { specials: [BONUS, HOLIDAY] });
  const rel = release({ specials: [{ special_id: 'sp1', date: '2026-12-16', time: '18:00', due: 'later', source: 'special' }] });

  test('the calendar marks a special\'s own day, and a two-parter\'s parts', () => {
    const { items } = calendarItems({ release: rel, roadmap: map, events: [] });
    const special = items.find((i) => i.key === 'special-sp1');
    expect(special).toMatchObject({ date: '2026-12-16', kind: 'release', special: true, title: 'Special: Midweek Rooftop', detail: 'Special · after E7 · its own day', tone: 'special' });
    expect(items.find((i) => i.key === 'release-s12').title).toBe('Releases E12 · Part 1/2');
    expect(items.some((i) => i.key === 'special-sp2')).toBe(false); // no date yet
  });

  test('the one-pager lists the specials apart, and the two-parter\'s event once', () => {
    const sheet = seasonPlanSheet({ roadmap: map, release: rel });
    expect(sheet.specials).toEqual([
      expect.objectContaining({ code: 'Special · after E7', kind: 'Bonus episode', title: 'Midweek Rooftop', when: 'Wed, Dec 16 · 6:00 PM', status: 'Event Pending' }),
      expect.objectContaining({ code: 'Holiday special', kind: 'Stand-alone special', place: 'after E12', when: null }),
    ]);
    expect(sheet.parts[1].slots[3].code).toBe('E12 · Part 1/2');
    expect(sheet.events.filter((e) => e.name === 'Gala')).toEqual([expect.objectContaining({ code: 'E12–E13' })]);
    expect(sheet.events.find((e) => e.code === 'Special · after E7').name).toBe('Midweek Rooftop');
  });

  test('the health line counts the specials planned, apart from the part', () => {
    const line = seasonHealth({ arc: { current_phase: 1 }, roadmap: map, coverage: null, release: null });
    expect(line.pieces.map((p) => p.text)).toEqual(['Part 1 is 0 of 8 ready', '2 specials planned']);
    expect(seasonHealth({ arc: { current_phase: 1 }, roadmap: { ...map, specials: [] } }).pieces.map((p) => p.key)).toEqual(['part']);
  });

  test('a bonus\'s event is in this season on the Events tab, with its special for a slot', () => {
    const views = seasonEventViews({ roadmap: map, events: [{ id: 'ev9', name: 'Midweek Rooftop' }, { id: 'loose', name: 'Loose' }] });
    expect(views.inSeason.find((v) => v.id === 'ev9').slot).toMatchObject({ special: true, code: 'Special · after E7' });
    expect(views.unplaced).toEqual(['loose']);
  });

  test('release lines name a special by its label and a part by its part', () => {
    const row = { special: { label: 'Special · after E7' }, number: null, date: '2026-12-16', time: '18:00', due: 'soon', days_until: 2 };
    expect(releaseLabel(row)).toBe('Special · after E7');
    expect(releaseLabel({ number: 12, two_part: { part: 1, of: 2 } })).toBe('E12 · Part 1/2');
    expect(releaseLabel({ number: 3 })).toBe('Episode 3');
    expect(deadlineWarning(row, null).text).toBe('Special · after E7 releases in 2 days.');
    const next = nextReleaseOf({ state: 'active', episodes: [{ ...row, season_number: 1, status: 'draft' }] }, 1, '2026-12-14');
    expect(next).toMatchObject({ state: 'next', code: 'Special · after E7', text: 'Wed, Dec 16' });
  });
});
