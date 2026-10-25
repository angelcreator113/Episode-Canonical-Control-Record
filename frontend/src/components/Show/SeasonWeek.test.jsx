/**
 * The Roadmap's This week view (Evoni, 2026-10-25): the next two or three
 * release days from the release schedule's dates and hand-set air dates
 * (else the next slots in order), each with its stage, what it still needs,
 * its event and Moves; the choice of view is remembered.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import SeasonWeek from './SeasonWeek';
import SeasonPage from '../../pages/SeasonPage';
import { weekAhead, weekWhen } from '../../lib/seasonWeek';
import { ROADMAP_VIEW_STORAGE_KEY } from './SeasonPageRoadmap';

const TODAY = '2099-01-01';
const slot = (n, extra = {}) => ({ id: `slot-${n}`, slot_number: n, phase: 1, state: 'needs_event', episode: null, event: null, intention: {}, ...extra });
const SLOTS = [
  slot(1, { state: 'done', episode: { id: 'ep-1', title: 'Pilot' } }),
  slot(2, { state: 'in_production', episode: { id: 'ep-2', title: 'Gala Night' }, event: { id: 'ev-2', name: 'Velvet Gala' } }),
  slot(3, { state: 'event_ready', event: { id: 'ev-3', name: 'Rooftop Launch' } }),
  slot(4),
  slot(5),
];
const ROADMAP = { phases: [{ phase: 1, title: 'Foundation', episode_start: 1, episode_end: 5, slots: SLOTS }], unslotted_episodes: [] };
const EPISODES = [
  { id: 'ep-1', episode_number: 1, title: 'Pilot', status: 'published' },
  { id: 'ep-2', episode_number: 2, title: 'Gala Night', status: 'in_build' },
];
const EVENTS = [{ id: 'ev-2', name: 'Velvet Gala' }, { id: 'ev-3', name: 'Rooftop Launch' }];
// The schedule's view (GET /world/:showId/release-schedule): every Sunday from Jan 4.
const VIEW = {
  schedule: { day: 'sun', time: '10:00' }, state: 'active',
  episodes: [
    { episode_id: 'ep-1', episode_number: 1, date: '2098-12-28', time: '10:00', source: 'schedule', due: 'released' },
    { episode_id: 'ep-2', episode_number: 2, date: '2099-01-04', time: '10:00', source: 'schedule', due: 'later', days_until: 3 },
  ],
  slots: {
    1: { date: '2098-12-28', time: '10:00', source: 'schedule' }, 2: { date: '2099-01-04', time: '10:00', source: 'schedule' },
    3: { date: '2099-01-11', time: '10:00', source: 'schedule' }, 4: { date: '2099-01-18', time: '10:00', source: 'schedule' },
    5: { date: '2099-01-25', time: '10:00', source: 'schedule' },
  },
};

describe('weekAhead', () => {
  test('the schedule\'s next three dates, soonest first; a done slot is left out', () => {
    const { mode, items } = weekAhead({ roadmap: ROADMAP, view: VIEW, episodes: EPISODES, today: TODAY });
    expect(mode).toBe('dated');
    expect(items.map((i) => i.slot.slot_number)).toEqual([2, 3, 4]);
    expect(weekWhen(items[0])).toBe('Sun, Jan 4 · 10:00 AM');
  });

  test('a hand-set air date counts and moves its slot up', () => {
    const view = { ...VIEW, episodes: VIEW.episodes.map((r) => (r.episode_id === 'ep-2' ? { ...r, date: '2099-01-20', source: 'hand' } : r)) };
    const { items } = weekAhead({ roadmap: ROADMAP, view, episodes: EPISODES, today: TODAY });
    expect(items.map((i) => i.slot.slot_number)).toEqual([3, 4, 2]);
    expect(weekWhen(items[2])).toBe('Tue, Jan 20 · 10:00 AM (set by hand)');
  });

  test('without a schedule, an episode\'s own air_date still dates it', () => {
    const eps = EPISODES.map((e) => (e.id === 'ep-2' ? { ...e, air_date: '2099-02-01' } : e));
    const { mode, items } = weekAhead({ roadmap: ROADMAP, view: null, episodes: eps, today: TODAY });
    expect(mode).toBe('dated');
    expect(items.map((i) => i.slot.slot_number)).toEqual([2]);
    expect(weekWhen(items[0])).toBe('Sun, Feb 1 (set by hand)');
  });

  test('no dates anywhere: the next three slots in order', () => {
    const { mode, items } = weekAhead({ roadmap: ROADMAP, view: { schedule: null, episodes: [], slots: {} }, episodes: EPISODES, today: TODAY });
    expect(mode).toBe('order');
    expect(items.map((i) => i.slot.slot_number)).toEqual([2, 3, 4]);
    expect(weekWhen(items[0])).toBe('No date yet');
  });

  test('a preview date reads "Would be"', () => {
    const view = { ...VIEW, state: 'preview', episodes: [], slots: { 3: { date: '2099-01-11', time: '10:00', source: 'preview' } } };
    const { items } = weekAhead({ roadmap: ROADMAP, view, episodes: EPISODES, today: TODAY });
    expect(weekWhen(items[0])).toBe('Would be Sun, Jan 11 · 10:00 AM');
  });
});

describe('SeasonWeek', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-2') return { data: { data: { id: 'ep-2', status: 'in_build', thumbnail_url: 'https://x/t.png' } } };
      if (url === '/api/v1/feed-posts/episode/ep-2') return { data: { data: [] } };
      return { data: {} };
    });
  });

  const draw = (props = {}) => render(
    <MemoryRouter>
      <SeasonWeek roadmap={ROADMAP} release={{ view: VIEW }} episodes={EPISODES} events={EVENTS} api={api} showId="show-1"
        movesBySlot={{ 'slot-3': [{ id: 'g1', title: 'Get booked' }] }} onOpen={vi.fn()} today={TODAY} {...props} />
    </MemoryRouter>,
  );

  test('each release: its date, stage, what it still needs, its event and Moves', async () => {
    const onOpen = vi.fn();
    draw({ onOpen });
    const two = screen.getByTestId('szw-item-2');
    expect(within(two).getByTestId('szw-when-2').textContent).toBe('Sun, Jan 4 · 10:00 AM');
    expect(within(two).getByText('Gala Night')).toBeTruthy();
    expect(within(two).getByText('In Production')).toBeTruthy();
    expect(within(two).getByTestId('szw-stage-2').textContent).toBe('In the edit');
    // Readiness from the episode's full row and its posts: the thumbnail is there, the rest is not.
    await waitFor(() => expect(within(two).getByTestId('szw-needs-2').textContent).toBe('Final cut, Title & copy, Pulse posts'));
    expect(within(two).getByTestId('szw-event-2').textContent).toBe('Velvet Gala');
    expect(within(two).getByRole('link', { name: 'Velvet Gala' }).getAttribute('href')).toBe('/shows/show-1/events/ev-2');

    const three = screen.getByTestId('szw-item-3');
    expect(within(three).getByTestId('szw-stage-3').textContent).toBe('No episode yet');
    expect(within(three).getByTestId('szw-needs-3').textContent).toBe('An episode made from its event');
    expect(within(three).getByTestId('szw-moves-3')).toBeTruthy();
    expect(within(screen.getByTestId('szw-item-4')).getByTestId('szw-event-4').textContent).toBe('None pencilled');
    expect(screen.queryByTestId('szw-item-5')).toBeNull();
    expect(screen.queryByTestId('szw-item-1')).toBeNull();

    fireEvent.click(within(three).getByTestId('szw-open-3'));
    expect(onOpen).toHaveBeenCalledWith(SLOTS[2]);
  });

  test('no schedule: the next slots in order, said so', () => {
    draw({ release: { view: null } });
    expect(screen.getByTestId('szw-note').textContent).toMatch(/No release dates yet/);
    expect(screen.getByTestId('szw-when-2').textContent).toBe('No date yet');
    expect(screen.getAllByTestId(/^szw-item-\d+$/).map((el) => el.dataset.testid)).toEqual(['szw-item-2', 'szw-item-3', 'szw-item-4']);
  });
});

describe('The Roadmap\'s This week toggle', () => {
  const ARC = { id: 'arc-1', title: 'Soft Luxury Ascension', season_number: 1, current_phase: 1, current_episode: 1, episode_end: 5, narrative_debt: [], progression_log: [], phases: [{ phase: 1, title: 'Foundation', status: 'active', episode_start: 1, episode_end: 5 }] };
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    window.localStorage.clear();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: ROADMAP } };
      if (url === '/api/v1/world/show-1/release-schedule') return { data: { data: VIEW } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: EPISODES } };
      return { data: {} };
    });
  });
  const open = (search) => render(
    <MemoryRouter initialEntries={[`/shows/show-1/season${search}`]}>
      <Routes><Route path="/shows/:showId/season" element={<SeasonPage />} /></Routes>
    </MemoryRouter>,
  );

  test('This week sits beside Grid and Timeline, and the choice is remembered', async () => {
    const first = open('?tab=roadmap');
    const week = await screen.findByTestId('szn-view-week');
    expect(screen.getByTestId('szn-roadmap-grid')).toBeTruthy();
    expect(week.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(week);
    expect(await screen.findByTestId('szn-roadmap-week')).toBeTruthy();
    expect(screen.getByTestId('szn-view-week').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('szn-roadmap-grid')).toBeNull();
    await waitFor(() => expect(window.localStorage.getItem(ROADMAP_VIEW_STORAGE_KEY)).toBe('week'));
    first.unmount();

    // Back on the Roadmap with no ?view=: This week again.
    open('?tab=roadmap');
    expect(await screen.findByTestId('szn-roadmap-week')).toBeTruthy();
  });

  test('the URL\'s view wins over the remembered one', async () => {
    window.localStorage.setItem(ROADMAP_VIEW_STORAGE_KEY, 'week');
    open('?tab=roadmap&view=timeline');
    expect(await screen.findByTestId('szn-roadmap-timeline')).toBeTruthy();
    expect(screen.queryByTestId('szn-roadmap-week')).toBeNull();
  });
});
