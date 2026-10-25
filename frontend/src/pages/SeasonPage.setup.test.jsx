/**
 * Setting up a season on the Season page (Evoni, 2026-10-24; moved from
 * Producer Mode's Season Plan tab, which the page replaced on 2026-10-25):
 * with no season the setup form is open and seeds from it; a completed
 * season offers "Start Season N" with the same form; the hero names the
 * real season and the stat card counts the episodes done in it; the
 * checklist's steps open their panels or run their action.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import SeasonPage from './SeasonPage';

const PHASES = [
  { phase: 1, title: 'Doors', tagline: 'Get in', status: 'active', episode_start: 1, episode_end: 6 },
  { phase: 2, title: 'Rooms', tagline: null, status: 'upcoming', episode_start: 7, episode_end: 16 },
  { phase: 3, title: 'Keys', tagline: null, status: 'upcoming', episode_start: 17, episode_end: 24 },
];
const ARC2 = {
  id: 'arc-2', title: 'Velvet Season', tagline: 'Her own room', season_number: 2, status: 'active', current_phase: 1, current_episode: 2,
  episode_end: 24, emotional_temperature: 'rising', narrative_debt: [], progression_log: [], phases: PHASES,
};
const slot = (n) => ({
  id: `slot-${n}`, slot_number: n, phase: n <= 6 ? 1 : n <= 16 ? 2 : 3, label: `S2 · E${n}`,
  state: n <= 2 ? 'done' : 'needs_event', locked: n <= 2, episode: n <= 2 ? { id: `ep-${n}`, title: `Made ${n}`, evaluation_status: 'accepted' } : null,
  event: null, intention: n <= 2 ? { story_purpose: 'Done' } : {}, result: {},
});
const ROADMAP = {
  arc: { id: 'arc-2', title: 'Velvet Season' }, season_number: 2, slot_count: 24,
  counts: { done: 2, in_production: 0, event_ready: 0, needs_event: 22 },
  phases: PHASES.map((p) => ({ ...p, slots: Array.from({ length: p.episode_end - p.episode_start + 1 }, (_, i) => slot(p.episode_start + i)) })),
  unslotted_episodes: [{ id: 'ep-x', title: 'Pilot', status: 'draft' }], available_events: [{ id: 'ev-1', name: 'Gala', status: 'draft' }],
};
// The show's episodes count across seasons: 9 here, 2 of them in Season 2.
const SHOW_EPISODES = Array.from({ length: 9 }, (_, i) => ({ id: `e${i}`, episode_number: i + 1, title: `E${i}`, status: 'published' }));

let arcResponse;
function mockGets({ goals = [], threads = [] } = {}) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: SHOW_EPISODES } };
    if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
    if (url === '/api/v1/world/show-1/arc') return { data: arcResponse };
    if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: arcResponse.arc?.status === 'active' ? ROADMAP : null } };
    if (url === '/api/v1/world/show-1/goals') return { data: { goals } };
    if (url === '/api/v1/world/show-1/season/threads') return { data: { threads, drafts: [] } };
    if (url === '/api/v1/world/show-1/season/placement') return { data: { items: [], open_slots: [], left_over: [] } };
    return { data: {} };
  });
}
function renderSeason() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/season']}>
      <Routes><Route path="/shows/:showId/season" element={<SeasonPage />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.post).mockResolvedValue({ data: {} });
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('Setting up a season on the Season page', () => {
  test('no season: the form is open, with no fixed "Soft Luxury" seed button; Save seeds from it', async () => {
    arcResponse = { arc: null, next_season_number: 1 };
    mockGets();
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, season_number: 1 } });
    renderSeason();
    expect(await screen.findByTestId('szn-empty')).toBeTruthy();
    expect(screen.queryByText('Seed Season 1')).toBeNull();
    fireEvent.change(screen.getByTestId('sst-title'), { target: { value: 'Velvet Season' } });
    fireEvent.click(screen.getByTestId('sst-submit'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/arc/seed', expect.objectContaining({
      title: 'Velvet Season', split: [8, 8, 8], phases: expect.any(Array),
    })));
    expect(window.alert).not.toHaveBeenCalled();
  });

  test('a completed season: "Start Season 2" opens the same form for Season 2', async () => {
    arcResponse = { arc: { ...ARC2, season_number: 1, title: 'Soft Luxury Ascension', status: 'completed' }, next_season_number: 2 };
    mockGets();
    renderSeason();
    const hero = await screen.findByTestId('szn-hero');
    expect(within(hero).getByRole('heading', { level: 1 }).textContent).toBe('Soft Luxury Ascension');
    expect(within(hero).getByText('Complete')).toBeTruthy();
    fireEvent.click(screen.getByTestId('szn-hero-more'));
    fireEvent.click(within(screen.getByTestId('szn-hero-menu')).getByRole('menuitem', { name: 'Start Season 2' }));
    expect(screen.getByRole('heading', { name: /Set up Season 2/ })).toBeTruthy();
    expect(screen.getByTestId('sst-title').value).toBe('Season 2');
  });

  test('Season 2: the hero names it, the slots card counts only its own episodes; the checklist is partly done', async () => {
    arcResponse = { arc: ARC2, next_season_number: 3 };
    mockGets({ goals: [{ id: 'g1', status: 'completed', title: 'Old' }] });
    renderSeason();
    const hero = await screen.findByTestId('szn-hero');
    expect(within(hero).getByText('Season 2')).toBeTruthy();
    expect(within(hero).getByRole('heading', { level: 1 }).textContent).toBe('Velvet Season');
    expect(screen.getByTestId('szn-stat-slots').textContent).toContain('2 completed · 22 remaining');
    const list = await screen.findByTestId('season-checklist');
    expect(within(list).getByTestId('sst-check-count').textContent).toBe('1 of 5 done');
    // The show has goals (from Season 1), none live: the action opens the Goals tab, not the seed.
    expect(within(list).getByTestId('sst-step-action-goals').textContent).toBe('Open Goals');
    fireEvent.click(within(list).getByTestId('sst-step-action-goals'));
    expect(await screen.findByTestId('career-goals')).toBeTruthy();
    expect(screen.getByTestId('szn-tab-goals').getAttribute('aria-selected')).toBe('true');
  });

  test('the checklist opens Edit season and the placement preview; Seed 24 goals runs the existing seed', async () => {
    arcResponse = { arc: ARC2, next_season_number: 3 };
    mockGets();
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, created: 24, skipped: 0 } });
    renderSeason();
    const list = await screen.findByTestId('season-checklist');
    fireEvent.click(within(list).getByTestId('sst-step-action-setup'));
    const form = screen.getByTestId('season-setup-form');
    expect(within(form).getByTestId('sst-part-title-1').value).toBe('Doors');
    expect(within(form).getByTestId('sst-split-2').value).toBe('10');
    fireEvent.click(within(list).getByTestId('sst-step-action-place'));
    expect(await screen.findByTestId('season-placement')).toBeTruthy();
    expect(screen.queryByTestId('season-setup-form')).toBeNull();
    fireEvent.click(within(list).getByTestId('sst-step-action-goals'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/goals/seed', { activate_tier: 1 }));
    expect((await screen.findByTestId('szn-setup-note')).textContent).toBe('Seeded 24 goals.');
  });

  test('Edit season saves through PUT .../arc/setup and says how many slots moved', async () => {
    arcResponse = { arc: ARC2, next_season_number: 3 };
    mockGets();
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, moved: 2 } });
    renderSeason();
    fireEvent.click(await screen.findByTestId('szn-edit-season'));
    fireEvent.change(screen.getByTestId('sst-split-1'), { target: { value: '8' } });
    fireEvent.change(screen.getByTestId('sst-split-2'), { target: { value: '8' } });
    fireEvent.click(screen.getByTestId('sst-submit'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/arc/setup', expect.objectContaining({ split: [8, 8, 8], title: 'Velvet Season' })));
    expect((await screen.findByTestId('szn-setup-note')).textContent).toBe('Season saved; 2 slots moved to a new part.');
  });
});
