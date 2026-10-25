/**
 * Producer Mode's show card and tab counts read the show's own data
 * (Evoni's redesign, 2026-10-05): the season and the episode in production
 * come from the episodes, and both are links (2026-10-25); World's count is
 * Lala's post drafts waiting (the Episodes and Events tabs, and their counts,
 * moved to the Season page); a tab with nothing waiting shows no count, and a
 * show with no episodes shows no chips but its own.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const SHOW = { id: 'show-1', name: 'Styling Adventures', metadata: {} };
let episodes = [];
let events = [];
let drafts = [];

const renderIt = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/world?tab=overview']}>
    <Routes><Route path="/shows/:id/world" element={<WorldAdmin />} /></Routes>
  </MemoryRouter>,
);
const count = (label) => {
  const tab = [...document.querySelectorAll('.wa-tab')].find((b) => b.querySelector('.wa-tab-label')?.textContent === label);
  return tab?.querySelector('.wa-tab-count')?.textContent ?? null;
};

describe('Producer Mode show card and tab counts', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: [SHOW] } };
      if (url === '/api/v1/shows/show-1') return { data: { success: true, data: SHOW } };
      if (url.startsWith('/api/v1/episodes?')) return { data: { data: episodes, pagination: { total: episodes.length } } };
      if (url === '/api/v1/world/show-1/events') return { data: { events } };
      if (url.startsWith('/api/v1/feed-posts?')) return { data: { data: drafts } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('the season, the episode in production and the counts come from the data', async () => {
    episodes = [
      { id: 'ep-2', episode_number: 2, season_number: 1, status: 'draft', title: 'Two' },
      { id: 'ep-1', episode_number: 1, season_number: 1, status: 'published', title: 'One' },
    ];
    events = [{ id: 'ev-1', name: 'Fabric and Form', status: 'draft' }];
    drafts = [{ id: 'p1', episode_id: null }, { id: 'p2', episode_id: 'ep-2' }];
    renderIt();
    // Both header pills are links (2026-10-25): the episode in production to its page, the season to the Season page.
    const producing = await screen.findByRole('link', { name: 'Producing Episode 2' });
    expect(producing.getAttribute('href')).toBe('/episodes/ep-2');
    // The header's season chip (the Overview's season switcher also says Season 1).
    const season = document.querySelector('.wa-chip-season');
    expect(season.textContent.trim()).toBe('Season 1');
    expect(season.tagName).toBe('A');
    expect(season.getAttribute('href')).toBe('/shows/show-1/season');
    // The one count left on the banner: Lala's post drafts waiting, under World.
    await waitFor(() => expect(count('World')).toBe('1'));
    expect(count('Overview')).toBeNull();
    expect(count('Season')).toBeNull();
    expect(screen.getByRole('link', { name: /Back to Shows/ }).getAttribute('href')).toBe('/shows');
  });

  test('with no episodes and no events: only the show chip, no counts', async () => {
    episodes = [];
    events = [];
    drafts = [];
    renderIt();
    await waitFor(() => expect(screen.getByTestId('wa-show-name').textContent).toBe('Styling Adventures'));
    expect(document.querySelector('.wa-chip-season')).toBeNull();
    expect(document.querySelector('.wa-chip-producing')).toBeNull();
    expect(document.querySelectorAll('.wa-tab-count')).toHaveLength(0);
  });
});
