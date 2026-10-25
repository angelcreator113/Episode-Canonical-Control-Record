/**
 * What is waiting on the Season page (lib/seasonAttention; Evoni,
 * 2026-10-25): each source, the ranking (overdue and deadlines first), the
 * cap with "+N more", the empty season, the tab counts, which episodes are
 * this season's, and the Next release card (lib/releaseSchedule).
 */
import { describe, test, expect } from 'vitest';
import {
  attentionItems, capAttention, tabBadges, episodeInSeason, seasonEpisodes, eventsNeedingSetup, goalGaps, emptySlotsSoon,
  heldOpportunities, releaseDeadlines, ATTENTION_CAP, showsAllSeasons,
} from './seasonAttention';
import { nextReleaseOf, seasonRows, slotWhen, deadlineWarning, moveText } from './releaseSchedule';

const ARC = { id: 'arc-2', season_number: 2, current_phase: 1 };
const slot = (n, over = {}) => ({ id: `s${n}`, slot_number: n, phase: n <= 3 ? 1 : n <= 6 ? 2 : 3, state: 'needs_event', locked: false, episode: null, event: null, ...over });
function roadmap(slots) {
  return {
    season_number: 2, arc: { id: 'arc-2', current_phase: 1 },
    phases: [1, 2, 3].map((p) => ({ phase: p, title: ['Foundation', 'Ascension', 'Legacy'][p - 1], slots: slots.filter((s) => s.phase === p) })),
  };
}
// Slot 1 has an episode, 2 an event needing setup, 3 empty; Part 2: 4 empty, 5 an event, 6 empty.
const ROADMAP = roadmap([
  slot(1, { episode: { id: 'ep-1', title: 'One' }, locked: true, state: 'in_production' }),
  slot(2, { event: { id: 'ev-2', name: 'Gala' }, state: 'event_ready' }),
  slot(3),
  slot(4),
  slot(5, { event: { id: 'ev-5', name: 'Brunch' }, state: 'event_ready' }),
  slot(6),
  slot(7), slot(8), slot(9),
]);
const EVENTS = [{ id: 'ev-2', name: 'Gala' }, { id: 'ev-5', name: 'Brunch' }, { id: 'ev-x', name: 'Not placed' }];
const COVERAGE = {
  parts: [
    { phase: 1, title: 'Foundation', gaps: [{ goal_id: 'g1', title: 'Save coins' }] },
    { phase: 2, title: 'Ascension', gaps: [{ goal_id: 'g1', title: 'Save coins' }, { goal_id: 'g2', title: 'Earn trust' }] },
    { phase: 3, title: 'Legacy', gaps: [] },
  ],
};
const row = (over) => ({ episode_id: 'ep-1', episode_number: 25, season_number: 2, number: 1, title: 'One', status: 'draft', date: '2026-11-01', time: '10:00', source: 'schedule', due: 'later', days_until: 7, ...over });
const RELEASE = { state: 'active', schedule: { day: 'sun' }, seasons: [{ season_number: 1 }, { season_number: 2, slots: { 3: { date: '2026-11-15', source: 'schedule' } } }], episodes: [] };
const base = (over = {}) => ({ showId: 'show-1', arc: ARC, roadmap: ROADMAP, events: EVENTS, episodes: [{ id: 'ep-1', title: 'One', status: 'draft' }], coverage: null, release: null, opps: [], ...over });

describe('the sources', () => {
  test('events in this season still needing setup, soonest slot first; a used one is not', () => {
    const list = eventsNeedingSetup({ roadmap: ROADMAP, events: [...EVENTS, { id: 'ev-u', name: 'Used', used_in_episode_id: 'ep-1' }] });
    expect(list.map((x) => [x.event.id, x.slot?.slot_number])).toEqual([['ev-2', 2], ['ev-5', 5]]);
    expect(list[0].missing.length).toBeGreaterThan(0);
  });
  test('goal gaps from the part in progress on; a part behind it is past', () => {
    expect(goalGaps(COVERAGE, { arc: ARC }).map((p) => [p.phase, p.current])).toEqual([[1, true], [2, false]]);
    expect(goalGaps(COVERAGE, { arc: { ...ARC, current_phase: 2 } }).map((p) => p.phase)).toEqual([2]);
  });
  test('empty slots in the part in progress and the next one only', () => {
    expect(emptySlotsSoon(ROADMAP, { arc: ARC }).map((p) => [p.phase, p.slots.map((s) => s.slot_number)])).toEqual([[1, [3]], [2, [4, 6]]]);
  });
  test('held opportunities, the stuck ones (episode completed) first', () => {
    const held = heldOpportunities([
      { id: 'o1', name: 'Velour', status: 'held', beat14_episode: { title: 'Two' } },
      { id: 'o2', name: 'Maison', status: 'held', beat14_episode: { title: 'One', evaluation_status: 'accepted' } },
      { id: 'o3', name: 'Free', status: 'offered' },
    ]);
    expect(held.map((h) => [h.opp.id, h.stuck])).toEqual([['o2', true], ['o1', false]]);
  });
  test("a release due soon says what its episode still needs (feed posts are not read here)", () => {
    const release = { ...RELEASE, episodes: [row({ due: 'soon', days_until: 3 })] };
    const [d] = releaseDeadlines(release, { seasonNumber: 2, episodes: [{ id: 'ep-1', status: 'in_build' }] });
    expect(d.missing).toEqual(['final cut', 'thumbnail', 'title & copy']);
  });
});

describe('attentionItems', () => {
  test('nothing waiting: an empty list', () => {
    const clear = roadmap([slot(1, { episode: { id: 'ep-1' }, locked: true, state: 'done' })]);
    expect(attentionItems(base({ roadmap: clear, events: [] }))).toEqual([]);
  });

  test('ranked: overdue, then due soon, then a stuck held one, the part in progress, events, gaps, later', () => {
    const release = { ...RELEASE, episodes: [row({ episode_id: 'ep-a', number: 2, due: 'soon', days_until: 3 }), row({ episode_id: 'ep-b', number: 1, due: 'overdue', days_until: -1 })] };
    const opps = [{ id: 'o1', name: 'Velour', status: 'held', beat14_episode: { title: 'Two' } }, { id: 'o2', name: 'Maison', status: 'held', beat14_episode: { title: 'One', evaluation_status: 'accepted' } }];
    const items = attentionItems(base({ release, opps, coverage: COVERAGE }));
    expect(items.map((i) => i.key)).toEqual([
      'release-ep-b', 'release-ep-a', 'held-o2', 'slots-1', 'event-ev-2', 'event-ev-5', 'gap-1', 'slots-2', 'gap-2', 'held-o1',
    ]);
    expect(items[0]).toMatchObject({ tone: 'overdue', link: { href: '/shows/show-1/world?tab=release' } });
    expect(items[0].title).toMatch(/^Episode 1 was due Sun, Nov 1 · 10:00 AM and is not released yet\./);
    expect(items[1].title).toBe('Episode 2 releases in 3 days.');
    expect(items.find((i) => i.key === 'slots-1')).toMatchObject({ title: 'Part 1 · Foundation: 1 slot with no event yet.', link: { tab: 'roadmap', extra: { slot: 3 } } });
    expect(items.find((i) => i.key === 'event-ev-2').link).toEqual({ href: '/shows/show-1/events/ev-2' });
    expect(items.find((i) => i.key === 'gap-2').title).toBe('Part 2 · Ascension: nothing moves Save coins, Earn trust.');
    expect(items.find((i) => i.key === 'held-o2').link).toEqual({ tab: 'opportunities' });
  });

  test('the release line names what the episode still needs', () => {
    const release = { ...RELEASE, episodes: [row({ due: 'soon', days_until: 3 })] };
    const [item] = attentionItems(base({ release, episodes: [{ id: 'ep-1', status: 'in_review', title: 'One' }], roadmap: roadmap([]), events: [] }));
    expect(item.title).toBe('Episode 1 releases in 3 days and still needs: thumbnail, title & copy.');
  });

  test('more than two events needing setup fold into one row to the Events tab', () => {
    const slots = [2, 3, 4].map((n) => slot(n, { event: { id: `e${n}`, name: `E${n} party` }, state: 'event_ready' }));
    const items = attentionItems(base({ roadmap: roadmap(slots), events: slots.map((s) => ({ id: s.event.id, name: s.event.name })) }));
    const ev = items.filter((i) => i.kind === 'events');
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ title: '3 events in this season still need setup.', link: { tab: 'events', extra: { show: 'in-season' } } });
    expect(ev[0].detail).toMatch(/^Soonest: E2 party \(E2\)/);
  });

  test('a past season leaves out goal gaps, empty slots and held opportunities', () => {
    const opps = [{ id: 'o1', name: 'Velour', status: 'held', beat14_episode: { title: 'Two' } }];
    const kinds = new Set(attentionItems(base({ coverage: COVERAGE, opps, isCurrent: false })).map((i) => i.kind));
    expect([...kinds]).toEqual(['events']);
  });

  test('a release of another season is not this season\'s', () => {
    const release = { ...RELEASE, episodes: [row({ season_number: 1, due: 'overdue' })] };
    expect(attentionItems(base({ release, roadmap: roadmap([]), events: [] }))).toEqual([]);
  });

  test('the cap: six rows and how many more', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ key: `k${i}` }));
    expect(ATTENTION_CAP).toBe(6);
    const { shown, more } = capAttention(items);
    expect(shown).toHaveLength(6);
    expect(more).toBe(3);
    expect(capAttention(items.slice(0, 4)).more).toBe(0);
  });
});

describe('tabBadges', () => {
  test('only the tabs with something waiting, with their wide wording', () => {
    const release = { ...RELEASE, episodes: [row({ due: 'soon', days_until: 3, date: '2026-11-01' })] };
    const opps = [{ id: 'o1', name: 'Velour', status: 'held' }];
    const b = tabBadges(base({ release, opps, coverage: COVERAGE }));
    expect(b).toEqual({
      events: { count: 2, text: '2 need setup', tone: 'calm' },
      goals: { count: 3, text: '3 gaps', tone: 'calm' },
      opportunities: { count: 1, text: '1 held', tone: 'calm' },
      episodes: { count: 1, text: '1 due Sunday', tone: 'soon' },
    });
  });
  test('overdue, due today, several due; nothing at all', () => {
    expect(tabBadges(base({ events: [], roadmap: roadmap([]), release: { ...RELEASE, episodes: [row({ due: 'overdue' })] } })).episodes.text).toBe('1 overdue');
    expect(tabBadges(base({ events: [], roadmap: roadmap([]), release: { ...RELEASE, episodes: [row({ due: 'soon', days_until: 0 })] } })).episodes.text).toBe('1 due today');
    expect(tabBadges(base({ events: [], roadmap: roadmap([]), release: { ...RELEASE, episodes: [row({ due: 'soon' }), row({ episode_id: 'x', due: 'soon' })] } })).episodes.text).toBe('2 due soon');
    expect(tabBadges(base({ events: [], roadmap: roadmap([]) }))).toEqual({});
  });
  test('one event needing setup reads "1 needs setup"', () => {
    expect(tabBadges(base({ roadmap: roadmap([slot(2, { event: { id: 'ev-2', name: 'Gala' } })]) })).events.text).toBe('1 needs setup');
  });
});

describe("this season's episodes", () => {
  test('in a slot, else its snapshot, else its season number (none is Season 1)', () => {
    const opts = { arc: ARC, roadmap: ROADMAP };
    expect(episodeInSeason({ id: 'ep-1', season_number: 1 }, opts)).toBe(true); // slotted wins
    expect(episodeInSeason({ id: 'a', season_context: { arc_id: 'arc-2' } }, opts)).toBe(true);
    expect(episodeInSeason({ id: 'b', season_context: JSON.stringify({ arc_id: 'arc-1', season_number: 2 }) }, opts)).toBe(false);
    expect(episodeInSeason({ id: 'c', season_number: 2 }, opts)).toBe(true);
    expect(episodeInSeason({ id: 'd' }, opts)).toBe(false);
    expect(episodeInSeason({ id: 'd' }, { arc: { id: 'arc-1', season_number: 1 }, roadmap: null })).toBe(true);
  });
  test('seasonEpisodes filters; with no season every episode', () => {
    const eps = [{ id: 'ep-1' }, { id: 'x', season_number: 1 }, { id: 'y', season_number: 2 }];
    expect(seasonEpisodes(eps, { arc: ARC, roadmap: ROADMAP }).map((e) => e.id)).toEqual(['ep-1', 'y']);
    expect(seasonEpisodes(eps, {})).toHaveLength(3);
  });
  test('?seasons=all shows every season', () => {
    expect(showsAllSeasons(new URLSearchParams('seasons=all'))).toBe(true);
    expect(showsAllSeasons(new URLSearchParams(''))).toBe(false);
  });
});

describe('the release schedule by season (lib/releaseSchedule)', () => {
  const view = (rows, over = {}) => ({ state: 'active', schedule: {}, seasons: [{ season_number: 1 }, { season_number: 2 }], episodes: rows, ...over });
  test('Next release: the earliest not yet out in this season, overdue first, with its code', () => {
    const v = view([
      row({ episode_id: 'a', season_number: 1, number: 9, date: '2026-10-25', due: 'released', status: 'published' }),
      row({ episode_id: 'b', number: 2, date: '2026-11-08' }),
      row({ episode_id: 'c', number: 1, date: '2026-10-25', due: 'overdue' }),
    ]);
    expect(nextReleaseOf(v, 2, '2026-10-30')).toMatchObject({ state: 'next', text: 'Sun, Oct 25', code: 'E1', overdue: true });
    expect(nextReleaseOf(view([row({ number: 3, date: '2026-11-01' })]), 2, '2026-10-30')).toMatchObject({ text: 'Sun, Nov 1', code: 'E3', overdue: false });
  });
  test('Next release: "Not releasing yet" for previews or nothing dated, "Paused" when paused, null before it loads', () => {
    expect(nextReleaseOf(view([row({ source: 'preview' })]), 2)).toEqual({ state: 'none', text: 'Not releasing yet' });
    expect(nextReleaseOf(view([], { state: 'paused' }), 2)).toEqual({ state: 'none', text: 'Paused' });
    expect(nextReleaseOf(null, 2)).toBeNull();
    expect(nextReleaseOf(view([row({ status: 'published', due: 'released' })]), 2)).toEqual({ state: 'none', text: 'Every episode is out' });
  });
  test('rows, slot dates and words by season; numbers restart', () => {
    const v = view([row({ episode_id: 'a', season_number: 1 }), row({ episode_id: 'b', season_number: 2 })]);
    expect(seasonRows(v, 1).map((r) => r.episode_id)).toEqual(['a']);
    expect(seasonRows({ episodes: v.episodes }, 1)).toHaveLength(2);
    const sv = { slots: { 3: { date: '2026-11-15', source: 'schedule' } }, seasons: [{ season_number: 1, slots: { 3: { date: '2026-03-01', source: 'preview' } } }], episodes: [] };
    expect(slotWhen(sv, { slot_number: 3 })).toEqual({ text: 'Sun, Nov 15', source: 'schedule' });
    expect(slotWhen(sv, { slot_number: 3 }, 1)).toEqual({ text: 'Would be Sun, Mar 1', source: 'preview' });
    expect(deadlineWarning(row({ number: 2, episode_number: 26, due: 'soon', days_until: 1 }), null).text).toBe('Episode 2 releases tomorrow.');
    expect(moveText({ number: 1, episode_number: 25, from: { date: '2026-11-01' }, to: { date: '2026-11-08' } })).toBe('E1 moves from Sun, Nov 1 to Sun, Nov 8');
  });
});
