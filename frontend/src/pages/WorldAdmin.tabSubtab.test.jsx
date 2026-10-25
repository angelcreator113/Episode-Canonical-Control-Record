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
 *
 * Six tabs (Evoni, 2026-10-25): Overview · Season · Assets · Cast &
 * Continuity · World · Release. Episodes, Opportunities and the Results
 * ledger moved to the Season page, and their old links open its tabs;
 * World holds Lala's posts, World moments and the Rate card.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin, { SEASON_PAGE_KEYS } from './WorldAdmin';
import { SEASON_TABS } from '../lib/seasonPage';

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

  test('the old Season Plan link, ?tab=season, opens the Season page', async () => {
    renderAt('season');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season'));
  });

  test('the old Career Goals link, ?tab=goals, opens the Season page on its Goals tab', async () => {
    renderAt('goals');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=goals'));
  });

  test('the banner has Season second; it opens the Season page', async () => {
    renderAt('overview');
    const season = await screen.findByTestId('wa-tab-season');
    expect(season.tagName).toBe('A');
    expect(season.getAttribute('href')).toBe('/shows/show-1/season');
    expect(within(season).getByText('Season')).toBeTruthy();
    fireEvent.click(season);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season'));
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

  // Evoni, 2026-10-25 ("Producer Mode is confusing"): eleven top tabs became six.
  test('the banner has exactly six tabs: Overview · Season · Assets · Cast & Continuity · World · Release', async () => {
    renderAt('overview');
    const bar = await waitFor(() => {
      const el = document.querySelector('.wa-tab-bar');
      if (!el) throw new Error('no tab bar');
      return el;
    });
    expect([...bar.querySelectorAll('.wa-tab .wa-tab-label')].map((b) => b.textContent)).toEqual(
      ['Overview', 'Season', 'Assets', 'Cast & Continuity', 'World', 'Release'],
    );
    expect(bar.querySelectorAll('.wa-tab')).toHaveLength(6);
  });
});

// World gathers Lala's posts, the world's moments and her rate card; their old links open there.
const MOMENTS = {
  success: true,
  settings: { auto_enabled: false, cities: { dazzle_district: [], radiance_row: [], echo_park: [], ascent_tower: [], maverick_harbor: [] }, press: {}, trends: { on: false, weekday: 2 }, award_shows: { on: false } },
  plan: { from: '2026-10-19', to: '2026-10-25', moments: [] }, recent: [], server: { world_moments_enabled: false, pulse_engine_enabled: false },
};
describe('World', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => (url.startsWith('/api/v1/world-moments') ? { data: MOMENTS } : { data: {} }));
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test("World's sub-tabs are Lala's posts, World moments and Rate card; it opens on Lala's posts", async () => {
    renderAt('overview');
    fireEvent.click(await screen.findByRole('button', { name: 'World' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/world?tab=feed'));
    const subs = document.querySelector('.wa-subtabs');
    expect([...subs.querySelectorAll('button')].map((b) => b.textContent)).toEqual(["Lala's posts", 'World moments', 'Rate card']);
    expect(isActive("Lala's posts")).toBe(true);
    expect(isActive('World')).toBe(true);
    expect(await screen.findByTestId('lala-feed')).toBeTruthy();
  });

  test.each([['feed', "Lala's posts"], ['moments', 'World moments'], ['rate-card', 'Rate card']])(
    '?tab=%s still opens it, under World', async (tab, name) => {
      renderAt(tab);
      await waitFor(() => expect(screen.getByRole('button', { name })).toBeTruthy());
      expect(isActive(name)).toBe(true);
      expect(isActive('World')).toBe(true);
      expect(screen.getByTestId('where').textContent).toBe(`/shows/show-1/world?tab=${tab}`);
    });
});

// Every old link to what moved lands on the Season page's tab for it.
describe('Old Producer Mode links to what moved to the Season page', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test.each([
    ['episodes', '/shows/show-1/season?tab=episodes'],
    ['episodes-production', '/shows/show-1/season?tab=episodes'],
    ['episodes-ledger', '/shows/show-1/season?tab=results'],
    ['opportunities', '/shows/show-1/season?tab=opportunities'],
    ['season-page', '/shows/show-1/season'],
    ['opportunities&deal_with=Maison%20Velour', '/shows/show-1/season?tab=opportunities&deal_with=Maison+Velour'],
  ])('?tab=%s opens %s', async (tab, to) => {
    renderAt(tab);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(to));
  });

  test('every old key in SEASON_PAGE_KEYS names a real Season page tab', () => {
    const keys = new Set(SEASON_TABS.map((t) => t.key));
    for (const tab of Object.values(SEASON_PAGE_KEYS)) if (tab) expect(keys.has(tab)).toBe(true);
    expect(Object.keys(SEASON_PAGE_KEYS)).toEqual(expect.arrayContaining(['episodes', 'episodes-production', 'episodes-ledger', 'opportunities', 'season', 'goals']));
  });

  // The event library stays reachable at its old address (it moves onto the Season page in step 2), out of the banner.
  test('?tab=events still opens the event library here, with Season lit and a line pointing to the Season page', async () => {
    renderAt('events');
    const note = await screen.findByTestId('events-season-note');
    expect(note.querySelector('a').getAttribute('href')).toBe('/shows/show-1/season?tab=events');
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/world?tab=events');
    expect(screen.getByTestId('wa-tab-season').className).toContain('active');
    expect(screen.queryByRole('button', { name: 'Events' })).toBeNull();
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
