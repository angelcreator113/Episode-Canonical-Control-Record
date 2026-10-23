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
import ShowManagement, { showFields, showStats, visibleShows, showActivity, sameNameTag } from './ShowManagement';

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
    localStorage.removeItem('primeStudios.activeShowId');
    vi.mocked(apiClient.get).mockReset().mockImplementation(async (url) => ({ data: { data: url.includes('/episodes?') ? [] : ROWS } }));
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

// Evoni's layout list, 2026-10-23.
const EPS = [
  { id: 'e1', season_number: 1, episode_number: 1, title: 'One', status: 'published', updated_at: '2026-10-01T00:00:00Z' },
  { id: 'e2', season_number: 1, episode_number: 2, title: 'Two', status: 'scripted', updated_at: '2026-10-10T00:00:00Z', air_date: '2026-11-01T12:00:00Z' },
  { id: 'e3', season_number: 1, episode_number: 3, title: 'Three', status: 'in_build', updated_at: '2026-10-20T00:00:00Z', air_date: '2026-11-08T12:00:00Z' },
  { id: 'e0', season_number: 1, episode_number: 9, title: 'Gone', status: 'archived' },
];

describe('My Shows layout list', () => {
  test('showActivity: by stage, the one to continue, the next air date', () => {
    const a = showActivity(EPS, Date.parse('2026-10-23T00:00:00Z'));
    expect(a.released).toBe(1);
    expect(a.inProgress).toBe(2);
    expect(a.current.id).toBe('e3');
    expect(a.nextAir).toEqual({ date: '2026-11-01T12:00:00Z', code: 'S1 E2' });
    expect(showActivity([], 0)).toEqual({ released: 0, inProgress: 0, current: null, nextAir: null });
  });

  test('sameNameTag tells same-name shows apart and leaves the rest alone', () => {
    const shows = [{ id: 'abcdef123456', name: 'Lala' }, { id: 'zzzzzzzz9', name: 'Lala' }, { id: 'q', name: 'Other' }];
    expect(sameNameTag(shows[0], shows)).toBe('Show ID abcdef12');
    expect(sameNameTag(shows[2], shows)).toBe('');
  });

  test('visibleShows puts the pinned show first, whatever the sort', () => {
    const shows = ROWS.map(showFields);
    expect(visibleShows(shows, { pinned: 's4' }).map((s) => s.id)[0]).toBe('s4');
    expect(visibleShows(shows, { sort: 'name', pinned: 's4' }).map((s) => s.id)).toEqual(['s4', 's3', 's1', 's2']);
  });

  describe('on the page', () => {
    const TWINS = [
      { id: 'aaaaaaaa-1', name: 'Styling Adventures with Lala', status: 'active', episodeCount: 6, updatedAt: '2026-10-01T10:00:00Z' },
      { id: 'bbbbbbbb-2', name: 'Styling Adventures with Lala', status: 'active', episodeCount: 0, updatedAt: '2026-10-20T10:00:00Z' },
    ];
    beforeEach(() => {
      localStorage.setItem('primeStudios.activeShowId', 'aaaaaaaa-1');
      vi.mocked(apiClient.get).mockReset().mockImplementation(async (url) => {
        if (url.includes('/episodes?show_id=aaaaaaaa-1')) return { data: { data: EPS } };
        if (url.includes('/episodes?')) return { data: { data: [] } };
        return { data: { data: TWINS } };
      });
    });

    test('the show being worked on comes first with its badge; the twins are told apart', async () => {
      renderPage();
      await waitFor(() => expect(screen.getAllByTestId('sm-card')).toHaveLength(2));
      const [first, second] = screen.getAllByTestId('sm-card');
      expect(within(first).getByTestId('sm-working').textContent).toBe('Working on');
      expect(within(second).queryByTestId('sm-working')).toBeNull();
      expect(within(first).getByTestId('sm-card-tag').textContent).toBe('Show ID aaaaaaaa');
      expect(within(second).getByTestId('sm-card-tag').textContent).toBe('Show ID bbbbbbbb');
    });

    test('each card says what is happening, with Continue', async () => {
      renderPage();
      const first = await waitFor(() => screen.getAllByTestId('sm-card')[0]);
      await waitFor(() => expect(within(first).getByTestId('sm-card-stages').textContent).toMatch(/^2 in production · 1 released/));
      expect(within(first).getByTestId('sm-continue').getAttribute('href')).toBe('/episodes/e3');
      expect(within(first).getByTestId('sm-continue').textContent).toContain('Continue S1 E3');
      // A show with no episodes says nothing more.
      expect(within(screen.getAllByTestId('sm-card')[1]).queryByTestId('sm-card-stages')).toBeNull();
    });

    test('the totals are one line; empty status tabs are hidden', async () => {
      renderPage();
      await waitFor(() => expect(screen.getAllByTestId('sm-card')).toHaveLength(2));
      expect(screen.getByLabelText('Show totals').textContent).toBe('2 shows · 2 active · 0 coming soon · 6 episodes');
      expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['All Shows', 'Active2']);
    });
  });
});
