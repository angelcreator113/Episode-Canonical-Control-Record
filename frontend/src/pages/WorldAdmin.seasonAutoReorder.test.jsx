/**
 * Season Arc no longer offers Auto-Reorder (Task #2363). Auto-Reorder moved
 * started events by re-injecting them into other episodes
 * (POST /api/v1/world/:showId/events/:id/inject); the server's terms lock
 * (§8(x) D4) refuses to change the episode link of an event that has
 * started an episode, and reordering belongs to future slots only.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

function renderAt(tab) {
  return render(
    <MemoryRouter initialEntries={[`/shows/show-1/world?tab=${tab}`]}>
      <Routes>
        <Route path="/shows/:id/world" element={<WorldAdmin />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Season Arc without Auto-Reorder (#2363)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) {
        return { data: { episodes: [{ id: 'ep-1', episode_number: 1, title: 'Gala Night', status: 'draft' }] } };
      }
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('the Season tab renders its arc with no Auto-Reorder control', async () => {
    renderAt('season');

    await waitFor(() => expect(screen.getByText(/Season 1: Soft Luxury Ascension/)).toBeTruthy());
    expect(screen.getByText('Episodes Done')).toBeTruthy();

    expect(screen.queryByText(/Auto-Reorder/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /reorder/i })).toBeNull();
    expect(screen.queryByText('Episode Order')).toBeNull();

    // Nothing on the Season tab re-injects events into episodes.
    const injects = vi.mocked(api.post).mock.calls.filter(([url]) => /\/inject$/.test(url));
    expect(injects).toEqual([]);
  });
});
