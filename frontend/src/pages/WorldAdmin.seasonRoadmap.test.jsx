/**
 * Season Arc build PR 1 (Evoni's rulings, 2026-10-01; EVENT_EPISODE_FLOW.md
 * §8(ff)): the Season tab centres on the 24-slot roadmap, each slot showing
 * its state (A2), numbered "S1 · E7" (Q3); episodes in no slot are listed
 * (Q4); Extend is removed (Q2).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const ARC = {
  title: 'Soft Luxury Ascension',
  tagline: 'The climb begins.',
  current_phase: 1,
  current_episode: 1,
  episode_end: 24,
  emotional_temperature: 'rising',
  narrative_debt: [],
  progression_log: [],
  phases: [{ phase: 1, title: 'Foundation', status: 'active', episode_start: 1, episode_end: 8 }],
};

const STATES = ['in_production', 'event_ready'];
function slot(n) {
  const state = STATES[n - 1] || 'needs_event';
  return {
    id: `slot-${n}`,
    slot_number: n,
    phase: Math.ceil(n / 8),
    label: `S1 · E${n}`,
    state,
    locked: n === 1,
    episode: n === 1 ? { id: 'ep-1', title: 'Gala Night' } : null,
    event: n === 2 ? { id: 'ev-2', name: 'Rooftop Launch' } : null,
    intention: {},
    result: {},
  };
}
const ROADMAP = {
  arc: { id: 'arc-1', title: 'Soft Luxury Ascension' },
  season_number: 1,
  slot_count: 24,
  counts: { done: 0, in_production: 1, event_ready: 1, needs_event: 22 },
  phases: [
    { phase: 1, title: 'Foundation', episode_start: 1, episode_end: 8, slots: [1, 2, 3, 4, 5, 6, 7, 8].map(slot) },
    { phase: 2, title: 'Ascension', episode_start: 9, episode_end: 16, slots: [9, 10, 11, 12, 13, 14, 15, 16].map(slot) },
    { phase: 3, title: 'Legacy', episode_start: 17, episode_end: 24, slots: [17, 18, 19, 20, 21, 22, 23, 24].map(slot) },
  ],
  unslotted_episodes: [{ id: 'ep-old', title: 'Pilot Test', status: 'draft', evaluation_status: null }],
  available_events: [{ id: 'ev-9', name: 'Gallery Night', status: 'draft' }],
};

function renderAt(tab) {
  return render(
    <MemoryRouter initialEntries={[`/shows/show-1/world?tab=${tab}`]}>
      <Routes>
        <Route path="/shows/:id/world" element={<WorldAdmin />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Season Arc roadmap (§8(ff) PR 1)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) {
        return { data: { episodes: [{ id: 'ep-1', episode_number: 1, title: 'Gala Night', status: 'draft' }] } };
      }
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: ROADMAP } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  });

  test('shows the 24 slots by phase, each with its S1 · E label and state', async () => {
    renderAt('season');

    const roadmap = await screen.findByTestId('season-roadmap');
    expect(within(roadmap).getByText('Roadmap · Season 1')).toBeTruthy();
    expect(within(roadmap).getByText(/Phase 1 · Foundation/)).toBeTruthy();
    expect(within(roadmap).getByText(/Phase 3 · Legacy/)).toBeTruthy();
    expect(roadmap.querySelectorAll('[data-testid^="season-slot-"]')).toHaveLength(24);

    const first = screen.getByTestId('season-slot-1');
    expect(within(first).getByText('S1 · E1')).toBeTruthy();
    expect(within(first).getByText('In production')).toBeTruthy();
    expect(within(first).getByText('Gala Night')).toBeTruthy();
    expect(within(first).getByText('Locked')).toBeTruthy();

    const second = screen.getByTestId('season-slot-2');
    expect(within(second).getByText('Event ready')).toBeTruthy();
    expect(within(second).getByText('Rooftop Launch')).toBeTruthy();

    expect(within(screen.getByTestId('season-slot-24')).getByText('Needs an event')).toBeTruthy();
  });

  test('lists episodes that are in no slot', async () => {
    renderAt('season');

    const unslotted = await screen.findByTestId('season-unslotted');
    expect(within(unslotted).getByText('Not in a slot (1)')).toBeTruthy();
    expect(within(unslotted).getByText('Pilot Test')).toBeTruthy();
  });

  test('offers no Extend control and never calls /arc/extend', async () => {
    renderAt('season');

    await waitFor(() => expect(screen.getByText(/Season 1: Soft Luxury Ascension/)).toBeTruthy());
    expect(screen.queryByText(/Extend/i)).toBeNull();
    const extends_ = vi.mocked(api.post).mock.calls.filter(([url]) => /\/arc\/extend$/.test(url));
    expect(extends_).toEqual([]);
  });

  test('a future slot can have an event pencilled in, moved or cleared (Q5); a started slot cannot', async () => {
    renderAt('season');
    await screen.findByTestId('season-roadmap');

    expect(screen.queryByTestId('season-pencil-1')).toBeNull(); // E1 is locked to its episode

    fireEvent.change(screen.getByTestId('season-pencil-4'), { target: { value: 'ev-9' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/api/v1/world/show-1/season/slots/slot-4/event', { event_id: 'ev-9' }));

    const second = screen.getByTestId('season-pencil-2');
    expect(within(second).getByText('Clear this slot')).toBeTruthy();
    fireEvent.change(second, { target: { value: '__clear__' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/api/v1/world/show-1/season/slots/slot-2/event', { event_id: null }));

    // The roadmap reloads after each change.
    const reloads = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/api/v1/world/show-1/season/roadmap');
    expect(reloads.length).toBeGreaterThanOrEqual(3);
  });

  test('an episode in no slot can be placed in an open slot after a confirm (Q4)', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('season');

    const select = await screen.findByTestId('season-place-ep-old');
    expect(within(select).queryByText('S1 · E1')).toBeNull(); // locked slots are not offered
    fireEvent.change(select, { target: { value: 'slot-3' } });

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/api/v1/world/show-1/season/slots/slot-3/episode', { episode_id: 'ep-old' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('S1 · E3'));
    confirm.mockRestore();
  });
});
