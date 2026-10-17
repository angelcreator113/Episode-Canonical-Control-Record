/**
 * My Shows (Evoni's mock, 2026-10-17): stats from the shows, status tabs,
 * search and sort, cards that open, edit and delete.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));
vi.mock('../services/api', () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}));

import apiClient from '../services/api';
import ShowManagement, { showFields, showStats, visibleShows } from './ShowManagement';

const ROWS = [
  { id: 's1', name: 'Styling Adventures with Lala', status: 'active', episodeCount: 12, coverImageUrl: 'https://x/s1.jpg', description: 'Fashion and real life', updatedAt: '2026-10-16T10:00:00Z' },
  { id: 's2', name: 'The Atelier', status: 'in_development', episode_count: 0, updated_at: '2026-10-10T10:00:00Z' },
  { id: 's3', name: 'Lala Travels', status: 'active', episodeCount: 10, description: 'Luxury destinations', updatedAt: '2026-10-12T10:00:00Z' },
  { id: 's4', name: 'Season 1 Recap', status: 'archived', episodeCount: 6, updatedAt: '2026-09-20T10:00:00Z' },
];

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

const renderPage = () => render(
  <MemoryRouter initialEntries={['/shows']}>
    <Routes>
      <Route path="/shows" element={<ShowManagement />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

const names = () => screen.getAllByTestId('sm-card').map((c) => within(c).getByRole('heading').textContent);

describe('My Shows helpers', () => {
  test('showFields reads model rows and raw table rows', () => {
    expect(showFields(ROWS[1])).toMatchObject({ episodes: 0, updated: '2026-10-10T10:00:00Z', cover: null, status: 'in_development' });
    expect(showFields({ id: 'x', cover_image_url: 'c.jpg', episode_count: '3' })).toMatchObject({ name: 'Untitled Show', cover: 'c.jpg', episodes: 3, status: 'active' });
  });

  test('showStats counts shows, active, coming soon and episodes', () => {
    expect(showStats(ROWS.map(showFields))).toEqual({ total: 4, active: 2, comingSoon: 1, episodes: 28 });
  });

  test('visibleShows filters by tab and search and sorts', () => {
    const shows = ROWS.map(showFields);
    expect(visibleShows(shows).map((s) => s.id)).toEqual(['s1', 's3', 's2', 's4']);
    expect(visibleShows(shows, { tab: 'active', sort: 'name' }).map((s) => s.id)).toEqual(['s3', 's1']);
    expect(visibleShows(shows, { query: 'luxury' }).map((s) => s.id)).toEqual(['s3']);
    expect(visibleShows(shows, { sort: 'episodes' }).map((s) => s.id)).toEqual(['s1', 's3', 's4', 's2']);
  });
});

describe('My Shows page', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset().mockResolvedValue({ data: { data: ROWS } });
    vi.mocked(apiClient.delete).mockReset().mockResolvedValue({ data: {} });
  });

  test('stats, cards newest first, and the whole cover', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('sm-card')).toHaveLength(4));
    expect(screen.getByTestId('sm-stat-total').textContent).toContain('4');
    expect(screen.getByTestId('sm-stat-active').textContent).toContain('2');
    expect(screen.getByTestId('sm-stat-soon').textContent).toContain('1');
    expect(screen.getByTestId('sm-stat-episodes').textContent).toContain('28');
    expect(names()).toEqual(['Styling Adventures with Lala', 'Lala Travels', 'The Atelier', 'Season 1 Recap']);
    const first = screen.getAllByTestId('sm-card')[0];
    expect(within(first).getByText('Active')).toBeTruthy();
    expect(within(first).getByText(/12 Episodes/)).toBeTruthy();
    expect(first.querySelector('img.sm-cover-img').getAttribute('src')).toBe('https://x/s1.jpg');
  });

  test('the Coming Soon tab and the search narrow the cards', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('sm-card')).toHaveLength(4));
    fireEvent.click(screen.getByRole('tab', { name: /Coming Soon/ }));
    expect(names()).toEqual(['The Atelier']);
    fireEvent.click(screen.getByRole('tab', { name: 'All Shows' }));
    fireEvent.change(screen.getByLabelText('Search shows'), { target: { value: 'travels' } });
    expect(names()).toEqual(['Lala Travels']);
  });

  test('Open Show goes to the show', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('sm-card')).toHaveLength(4));
    fireEvent.click(within(screen.getAllByTestId('sm-card')[1]).getByText('Open Show'));
    expect(screen.getByTestId('where').textContent).toBe('/shows/s3');
  });

  test('Edit from the menu', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('sm-card')).toHaveLength(4));
    fireEvent.click(screen.getByLabelText('More for The Atelier'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Edit/ }));
    expect(screen.getByTestId('where').textContent).toBe('/shows/s2/edit');
  });

  test('Delete asks first and shows the server message when refused', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(apiClient.delete).mockRejectedValueOnce({ response: { data: { message: 'Show has episodes' } } });
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('sm-card')).toHaveLength(4));
    fireEvent.click(screen.getByLabelText('More for Season 1 Recap'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(window.confirm).toHaveBeenCalled();
    expect(apiClient.delete).toHaveBeenCalledWith(expect.stringMatching(/\/shows\/s4$/));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Show has episodes'));
  });
});
