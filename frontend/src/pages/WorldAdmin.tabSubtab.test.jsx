/**
 * Producer Mode deep links that name a main tab open one of its sub-tabs
 * (Task #2289). ?tab=episodes resolved to ['episodes', 'episodes-ledger'],
 * but the mount effect set the sub-tab only when the main tab differed from
 * the one asked for, so Episodes opened with no sub-tab and an empty body.
 * The same held for ?tab=wardrobe and ?tab=characters.
 *
 * Season (Evoni, 2026-10-25): the banner's Season entry opens the Season
 * page; the Season Plan sub-tab is gone from Episodes, and its old links
 * (?tab=season, ?tab=goals) open the Season page, goals on its Goals tab.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

function Where() {
  const loc = useLocation();
  return <span data-testid="where">{loc.pathname}{loc.search}</span>;
}
function renderAt(tab) {
  return render(
    <MemoryRouter initialEntries={[`/shows/show-1/world?tab=${tab}`]}>
      <Routes>
        <Route path="/shows/:id/world" element={<><WorldAdmin /><Where /></>} />
        <Route path="/shows/:showId/season" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
}

// The active sub-tab button is the one drawn in the active colour.
// The active tab says so (aria-current), whatever the theme colors it.
const isActive = (name) => screen.getByRole('button', { name }).getAttribute('aria-current') === 'page';

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

    // Now producing and its board card both name it.
    await waitFor(() => expect(screen.getAllByText('Gala Night').length).toBeGreaterThan(0));
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
    renderAt('episodes-ledger');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Results' })).toBeTruthy());
    expect(isActive('Results')).toBe(true);
    expect(isActive('Production')).toBe(false);
  });

  test('Episodes has Production and Results; the Season Plan sub-tab is gone', async () => {
    renderAt('episodes');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Production' })).toBeTruthy());
    const subs = document.querySelector('.wa-subtabs');
    expect([...subs.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Production', 'Results']);
    expect(screen.queryByRole('button', { name: 'Season Plan' })).toBeNull();
  });

  test('the old Season Plan link, ?tab=season, opens the Season page', async () => {
    renderAt('season');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season'));
  });

  test('the old Career Goals link, ?tab=goals, opens the Season page on its Goals tab', async () => {
    renderAt('goals');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=goals'));
  });

  test('the banner has Season beside Episodes and Events; it opens the Season page', async () => {
    renderAt('overview');
    const season = await screen.findByTestId('wa-tab-season');
    expect(season.tagName).toBe('A');
    expect(season.getAttribute('href')).toBe('/shows/show-1/season');
    expect(within(season).getByText('Season')).toBeTruthy();
    fireEvent.click(season);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season'));
  });

  test("?tab=feed opens Lala's posts here, not the standalone page", async () => {
    renderAt('feed');
    expect(await screen.findByTestId('lala-feed')).toBeTruthy();
    expect(isActive("Lala's posts")).toBe(true);
  });

  test('Release opens on Next release', async () => {
    renderAt('release');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next release' })).toBeTruthy());
    expect(isActive('Next release')).toBe(true);
    expect(isActive('Distribution')).toBe(false);
  });

  test('Distribution and Insights open in Release', async () => {
    renderAt('insights');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insights' })).toBeTruthy());
    expect(isActive('Insights')).toBe(true);
    expect(isActive('Distribution')).toBe(false);
  });

  test('the main tabs are Overview · Episodes · Season · Events · Assets · Cast & Continuity · Lala\'s Feed · Release', async () => {
    renderAt('overview');
    const bar = await waitFor(() => {
      const el = document.querySelector('.wa-tab-bar');
      if (!el) throw new Error('no tab bar');
      return el;
    });
    expect([...bar.querySelectorAll('.wa-tab .wa-tab-label')].map((b) => b.textContent)).toEqual(
      ['Overview', 'Episodes', 'Season', 'Events', 'Opportunities', 'Rate card', 'World moments', 'Assets', 'Cast & Continuity', "Lala's posts", 'Release'],
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
