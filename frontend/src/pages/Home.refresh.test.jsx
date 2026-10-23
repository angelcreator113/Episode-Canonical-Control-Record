/**
 * Home's Refresh (Evoni, 2026-10-23: "still can't refresh landing page").
 * Pull-to-refresh is off on phones (index.css, App.css), so the page has
 * its own Refresh: it reloads every section's data and keeps the page on
 * screen while it does.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('../services/universeService', () => ({ default: { getUniverses: vi.fn(), getSeries: vi.fn() } }));
vi.mock('../services/storytellerService', () => ({ default: { getBooks: vi.fn() } }));
vi.mock('../services/showService', () => ({ showService: { getAllShows: vi.fn() } }));
vi.mock('../services/episodeService', () => ({ episodeService: { getEpisodes: vi.fn() } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Evoni' } }) }));

import apiClient from '../services/api';
import universeService from '../services/universeService';
import storytellerService from '../services/storytellerService';
import { showService } from '../services/showService';
import { episodeService } from '../services/episodeService';
import Home from './Home';

let shows;

describe('Home Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shows = [{ id: 's1', name: 'Styling Adventures' }];
    vi.mocked(universeService.getUniverses).mockResolvedValue([]);
    vi.mocked(universeService.getSeries).mockResolvedValue([]);
    vi.mocked(storytellerService.getBooks).mockResolvedValue([]);
    vi.mocked(showService.getAllShows).mockImplementation(async () => shows);
    vi.mocked(episodeService.getEpisodes).mockResolvedValue({ data: [] });
    vi.mocked(apiClient.get).mockResolvedValue({ data: { registries: [] } });
  });

  const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);

  test('Refresh reloads every section and shows what changed', async () => {
    renderHome();
    expect(await screen.findByText('Styling Adventures')).toBeTruthy();
    expect(showService.getAllShows).toHaveBeenCalledTimes(1);

    shows = [...shows, { id: 's2', name: 'Before Lala' }];
    fireEvent.click(screen.getByTestId('home-refresh'));

    expect(await screen.findByText('Before Lala')).toBeTruthy();
    for (const fn of [universeService.getUniverses, universeService.getSeries, storytellerService.getBooks,
      showService.getAllShows, episodeService.getEpisodes, apiClient.get]) {
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });

  test('the page stays on screen while it refreshes, and the button says so', async () => {
    renderHome();
    await screen.findByText('Styling Adventures');
    let finish;
    vi.mocked(showService.getAllShows).mockImplementation(() => new Promise((r) => { finish = () => r(shows); }));

    const btn = screen.getByTestId('home-refresh');
    fireEvent.click(btn);
    await waitFor(() => expect(btn.textContent).toBe('Refreshing…'));
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    // Not the full-page spinner: the shows are still there.
    expect(screen.queryByText('Loading your workspace…')).toBeNull();
    expect(screen.getByText('Styling Adventures')).toBeTruthy();
    // A second tap while it runs does nothing.
    fireEvent.click(btn);

    finish();
    await waitFor(() => expect(btn.textContent).toBe('Refresh'));
    expect(btn.disabled).toBe(false);
    expect(showService.getAllShows).toHaveBeenCalledTimes(2);
  });

  test('a section that fails on refresh keeps what it showed', async () => {
    renderHome();
    await screen.findByText('Styling Adventures');
    vi.mocked(showService.getAllShows).mockRejectedValue(new Error('offline'));
    fireEvent.click(screen.getByTestId('home-refresh'));
    await waitFor(() => expect(screen.getByTestId('home-refresh').textContent).toBe('Refresh'));
    expect(screen.getByText('Styling Adventures')).toBeTruthy();
  });
});
