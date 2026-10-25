/**
 * The Season page's three views of the event library (Evoni's Producer Mode
 * restructure, step 2, 2026-10-25): In this season · Not placed yet · All,
 * and the filter read from the URL or remembered.
 */
import { describe, test, expect } from 'vitest';
import { seasonEventViews, scopeEvents, eventShowFrom, EVENT_SHOWS, EVENT_SHOW_DEFAULT } from './eventLibrary';

const slot = (n, { event = null, episode = null } = {}) => ({ id: `slot-${n}`, slot_number: n, phase: 1, event, episode });
const ROADMAP = {
  phases: [{ phase: 1, slots: [
    slot(3, { event: { id: 'ev-c' } }),
    slot(1, { episode: { id: 'ep-1' } }),
    slot(2, { event: { id: 'ev-b' }, episode: { id: 'ep-2' } }),
    slot(4),
  ] }],
  available_events: [{ id: 'ev-free' }],
};
const EVENTS = [
  { id: 'ev-b' }, { id: 'ev-c' },
  { id: 'ev-ep1', used_in_episode_id: 'ep-1' },
  // ep-2's slot holds ev-b too: both are slot 2's.
  { id: 'ev-ep2', used_in_episode_id: 'ep-2' },
  { id: 'ev-s1', used_in_episode_id: 'ep-9' },
  { id: 'ev-old', used_in_episode_id: 'ep-old' },
  { id: 'ev-free' }, { id: 'ev-declined', status: 'declined' },
];
const EPISODES = [{ id: 'ep-1', season_number: 1 }, { id: 'ep-9', season_number: 1 }, { id: 'ep-old', season_number: 0 }];

describe('seasonEventViews', () => {
  test('In this season: slot order, each slot\'s event and its episode\'s, then the season\'s other episodes\' events', () => {
    const v = seasonEventViews({ roadmap: ROADMAP, events: EVENTS, episodes: EPISODES, seasonNumber: 1 });
    expect(v.inSeason.map((x) => [x.id, x.slot?.slot_number ?? null])).toEqual([['ev-ep1', 1], ['ev-b', 2], ['ev-ep2', 2], ['ev-c', 3], ['ev-s1', null]]);
  });

  test('Not placed yet: in no slot and in no episode; All: every event; pencillable: the roadmap\'s available events', () => {
    const v = seasonEventViews({ roadmap: ROADMAP, events: EVENTS, episodes: EPISODES, seasonNumber: 1 });
    expect(v.unplaced).toEqual(['ev-free', 'ev-declined']);
    expect(v.all).toHaveLength(EVENTS.length);
    expect([...v.pencillable]).toEqual(['ev-free']);
  });

  test('no roadmap: nothing in season, and every unused event is not placed', () => {
    const v = seasonEventViews({ roadmap: null, events: EVENTS });
    expect(v.inSeason).toEqual([]);
    expect(v.unplaced).toEqual(['ev-b', 'ev-c', 'ev-free', 'ev-declined']);
  });
});

describe('scopeEvents and the filter', () => {
  test('a scope keeps its order and skips ids the list lacks; no scope is every event', () => {
    const events = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(scopeEvents(events, { ids: ['c', 'x', 'a'] }).map((e) => e.id)).toEqual(['c', 'a']);
    expect(scopeEvents(events, null)).toBe(events);
  });

  test('the URL wins, then the remembered filter, then In this season', () => {
    expect(EVENT_SHOWS.map((s) => s.label)).toEqual(['In this season', 'Not placed yet', 'All']);
    expect(eventShowFrom('all', 'unplaced')).toBe('all');
    expect(eventShowFrom(null, 'unplaced')).toBe('unplaced');
    expect(eventShowFrom('bogus', 'nonsense')).toBe(EVENT_SHOW_DEFAULT);
    expect(EVENT_SHOW_DEFAULT).toBe('in-season');
  });
});
