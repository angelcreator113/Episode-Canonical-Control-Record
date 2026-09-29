/**
 * Producer Mode deep links that name a main tab open one of its sub-tabs
 * (Task #2289). ?tab=episodes resolved to ['episodes', 'episodes-ledger'],
 * but the mount effect set the sub-tab only when the main tab differed from
 * the one asked for, so Episodes opened with no sub-tab and an empty body.
 * The same held for ?tab=wardrobe and ?tab=characters.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

function renderAt(tab) {
  return render(
    <MemoryRouter initialEntries={[`/shows/show-1/world?tab=${tab}`]}>
      <Routes>
        <Route path="/shows/:id/world" element={<WorldAdmin />} />
      </Routes>
    </MemoryRouter>
  );
}

// The active sub-tab button is the one drawn in the active colour.
const ACTIVE = 'rgb(99, 102, 241)';
const isActive = (name) => screen.getByRole('button', { name }).style.color === ACTIVE;

describe('WorldAdmin ?tab=<main tab> opens a sub-tab (#2289)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) {
        return { data: { episodes: [{ id: 'ep-1', episode_number: 1, title: 'Gala Night', status: 'draft' }] } };
      }
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('?tab=episodes opens the Episode Ledger', async () => {
    renderAt('episodes');

    await waitFor(() => expect(screen.getByText('Gala Night')).toBeTruthy());
    expect(isActive('Episode Ledger')).toBe(true);
    expect(isActive('Season Arc')).toBe(false);
  });

  test('?tab=characters opens Character Stats', async () => {
    renderAt('characters');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Character Stats' })).toBeTruthy());
    expect(isActive('Character Stats')).toBe(true);
  });

  test('?tab=wardrobe opens Scene Sets', async () => {
    renderAt('wardrobe');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Scene Sets' })).toBeTruthy());
    expect(isActive('Scene Sets')).toBe(true);
  });

  test('a sub-tab deep link still lands on that sub-tab', async () => {
    renderAt('season');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Season Arc' })).toBeTruthy());
    expect(isActive('Season Arc')).toBe(true);
    expect(isActive('Episode Ledger')).toBe(false);
  });
});
