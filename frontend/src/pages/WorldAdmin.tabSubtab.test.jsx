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

  // One show workspace (2026-10-03): Episodes opens on Production, its first view.
  test('?tab=episodes opens Production', async () => {
    renderAt('episodes');

    await waitFor(() => expect(screen.getByText('Gala Night')).toBeTruthy());
    expect(isActive('Production')).toBe(true);
    expect(isActive('Results')).toBe(false);
    expect(screen.getByTestId('show-episodes-board')).toBeTruthy();
  });

  test('?tab=episodes-ledger opens Results', async () => {
    renderAt('episodes-ledger');

    await waitFor(() => expect(screen.getByText('Gala Night')).toBeTruthy());
    expect(isActive('Results')).toBe(true);
  });

  test("?tab=characters opens Lala's State & Continuity", async () => {
    renderAt('characters');

    await waitFor(() => expect(screen.getByRole('button', { name: "Lala's State & Continuity" })).toBeTruthy());
    expect(isActive("Lala's State & Continuity")).toBe(true);
  });

  test('?tab=wardrobe opens Scene Sets', async () => {
    renderAt('wardrobe');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Scene Sets' })).toBeTruthy());
    expect(isActive('Scene Sets')).toBe(true);
  });

  test('a sub-tab deep link still lands on that sub-tab', async () => {
    renderAt('season');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Season Plan' })).toBeTruthy());
    expect(isActive('Season Plan')).toBe(true);
    expect(isActive('Results')).toBe(false);
  });

  test('Career Goals open in the Season Plan', async () => {
    renderAt('goals');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Season Plan' })).toBeTruthy());
    expect(isActive('Season Plan')).toBe(true);
  });

  test('Distribution and Insights open in Release', async () => {
    renderAt('insights');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insights' })).toBeTruthy());
    expect(isActive('Insights')).toBe(true);
    expect(isActive('Distribution')).toBe(false);
  });

  test('the main tabs are Overview · Episodes · Events · Assets · Cast & Continuity · Release', async () => {
    renderAt('overview');
    const bar = await waitFor(() => {
      const el = document.querySelector('.wa-tab-bar');
      if (!el) throw new Error('no tab bar');
      return el;
    });
    expect([...bar.querySelectorAll('button')].map((b) => b.textContent.replace(/^\S+\s/, ''))).toEqual(
      ['Overview', 'Episodes', 'Events', 'Assets', 'Cast & Continuity', 'Release'],
    );
  });
});

describe('WorldAdmin ?tab=wardrobe-items (the show page\'s wardrobe links)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('opens Assets → Wardrobe', async () => {
    renderAt('wardrobe-items');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Wardrobe' })).toBeTruthy());
    expect(isActive('Wardrobe')).toBe(true);
    expect(isActive('Scene Sets')).toBe(false);
  });
});
