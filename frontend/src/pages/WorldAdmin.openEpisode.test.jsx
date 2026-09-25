/**
 * Producer Mode -> Events queue — Open Episode destination (Task #1905).
 *
 * A Used event's primary action, Open Episode, lands on the episode's
 * Overview (`?tab=overview`), per Evoni's ruling of 2026-09-25. It orients.
 * EpisodeDetail's own default tab (Checklist, #1531) is unchanged.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const USED_EVENT = {
  id: 'ev-used',
  show_id: 'show-1',
  name: 'Velour Awards Night',
  status: 'used',
  used_in_episode_id: 'ep-7',
  prestige: 6,
  canon_consequences: { automation: {} },
};

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="landed">{loc.pathname}{loc.search}</div>;
}

function renderQueue() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/world?tab=events']}>
      <Routes>
        <Route path="/shows/:id/world" element={<WorldAdmin />} />
        <Route path="/episodes/:episodeId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('WorldAdmin events queue — Open Episode lands on Overview', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events: [USED_EVENT] } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) {
        return { data: { episodes: [{ id: 'ep-7', episode_number: 7, title: 'Velour', status: 'draft' }] } };
      }
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('a Used event card\'s Open Episode navigates to /episodes/:id?tab=overview', async () => {
    renderQueue();
    const card = await screen.findByTestId('event-card-ev-used');
    await waitFor(() => expect(within(card).getByText(/Episode 7: Velour/)).toBeTruthy());

    fireEvent.click(within(card).getByRole('button', { name: /Open Episode/ }));

    await waitFor(() => expect(screen.getByTestId('landed').textContent).toBe('/episodes/ep-7?tab=overview'));
  });
});
