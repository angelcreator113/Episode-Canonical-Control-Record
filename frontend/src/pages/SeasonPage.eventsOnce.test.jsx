/**
 * Load events once (Evoni, 2026-10-25): the Season page reads the show's
 * events and episodes, and its Events tab's library draws those instead of
 * fetching them again. A change in the library reloads them once, at the
 * page (onChanged), not twice.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import SeasonPage from './SeasonPage';

const ARC = {
  id: 'arc-1', title: 'Soft Luxury Ascension', season_number: 1, current_phase: 1, current_episode: 1, episode_end: 2,
  narrative_debt: [], progression_log: [], phases: [{ phase: 1, title: 'Foundation', status: 'active', episode_start: 1, episode_end: 2 }],
};
const ROADMAP = {
  arc: { id: 'arc-1' }, season_number: 1, slot_count: 2,
  phases: [{ phase: 1, title: 'Foundation', episode_start: 1, episode_end: 2, slots: [
    { id: 'slot-1', slot_number: 1, phase: 1, state: 'event_ready', episode: null, event: { id: 'ev-1', name: 'Velour Launch' }, intention: {} },
    { id: 'slot-2', slot_number: 2, phase: 1, state: 'needs_event', episode: null, event: null, intention: {} },
  ] }],
  unslotted_episodes: [], available_events: [],
};
const EVENTS = [
  { id: 'ev-1', show_id: 'show-1', name: 'Velour Launch', status: 'draft', prestige: 5, canon_consequences: { automation: {} } },
  { id: 'ev-2', show_id: 'show-1', name: 'Atelier Night', status: 'draft', prestige: 6, canon_consequences: { automation: {} } },
];

const renderEvents = (show = 'all') => render(
  <MemoryRouter initialEntries={[`/shows/show-1/season?tab=events&show=${show}`]}>
    <Routes><Route path="/shows/:showId/season" element={<SeasonPage />} /></Routes>
  </MemoryRouter>,
);
const calls = (test) => vi.mocked(api.get).mock.calls.filter(([url]) => test(url)).length;
const eventReads = () => calls((u) => u === '/api/v1/world/show-1/events');
const episodeReads = () => calls((u) => u.startsWith('/api/v1/episodes?show_id=show-1'));

let wardrobeFails;
describe('The Events tab reads the page\'s events and episodes', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    window.localStorage.clear();
    wardrobeFails = false;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events: EVENTS } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: [{ id: 'ep-1', episode_number: 1, title: 'Gala', status: 'draft' }] } };
      if (url.startsWith('/api/v1/wardrobe?show_id=show-1') && wardrobeFails) throw new Error('closet down');
      if (url === '/api/v1/shows/show-1') return { data: { data: { id: 'show-1', name: 'Show' } } };
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: ROADMAP } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('opening the Events tab reads the events once and the episodes once', async () => {
    renderEvents();
    expect(await screen.findByTestId('event-card-ev-2')).toBeTruthy();
    expect(screen.getByTestId('event-card-ev-1')).toBeTruthy();
    // Let every load settle, then count.
    await waitFor(() => expect(calls((u) => u.startsWith('/api/v1/wardrobe'))).toBeGreaterThan(0));
    expect(eventReads()).toBe(1);
    expect(episodeReads()).toBe(1);
  });

  test('the in-season view draws the page\'s events too (one read each)', async () => {
    renderEvents('in-season');
    expect(await screen.findByTestId('event-card-ev-1')).toBeTruthy();
    expect(screen.queryByTestId('event-card-ev-2')).toBeNull();
    expect(eventReads()).toBe(1);
    expect(episodeReads()).toBe(1);
  });

  test('a reload from the library (its Retry) reads the events and episodes once more, at the page', async () => {
    wardrobeFails = true;
    renderEvents();
    const banner = await screen.findByTestId('evl-load-failed');
    expect(banner.textContent).toContain('wardrobe');
    expect(eventReads()).toBe(1);
    wardrobeFails = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByTestId('evl-load-failed')).toBeNull());
    await waitFor(() => expect(eventReads()).toBe(2));
    expect(episodeReads()).toBe(2);
  });

  test('when the page could not read the events, the library says so', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') throw new Error('down');
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: ROADMAP } };
      return { data: {} };
    });
    renderEvents();
    expect((await screen.findByTestId('evl-load-failed')).textContent).toContain('events');
    expect(eventReads()).toBe(1);
  });
});
