/**
 * Home's Refresh (Evoni, 2026-10-23: "still can't refresh landing page").
 * Pull-to-refresh is off on phones (index.css, App.css), so the page has
 * its own Refresh: it reads every card again and keeps the page on screen.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Evoni' } }) }));

import apiClient from '../services/api';
import Home from './Home';
import { POSTS, answerFor } from './Home.fixtures';

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);
const calls = (part) => vi.mocked(apiClient.get).mock.calls.filter(([u]) => u.includes(part)).length;

describe('Home Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation(answerFor());
  });

  test('Refresh reads every card again and shows what changed', async () => {
    renderHome();
    expect(await screen.findByText('Which bag?')).toBeTruthy();
    vi.mocked(apiClient.get).mockImplementation(answerFor({ '/api/v1/feed-posts': { data: [...POSTS, { id: 'p9', content_text: 'Brand new post', poster_handle: 'x', likes: 99999 }] } }));
    fireEvent.click(screen.getByTestId('home-refresh'));
    expect(await screen.findByText('Brand new post')).toBeTruthy();
    for (const part of ['/api/v1/shows', '/api/v1/episodes?', '/world/show-1/events', '/api/v1/feed-posts', '/characters/lala/state', '/api/v1/daily-update', '/api/v1/public/looks', 'character-registry/registries', 'storyteller/books']) {
      expect(calls(part)).toBe(2);
    }
  });

  test('the page stays on screen while it refreshes, and a second tap does nothing', async () => {
    renderHome();
    await screen.findByText('Which bag?');
    let finish;
    const slow = answerFor();
    vi.mocked(apiClient.get).mockImplementation((url) => (url.includes('/api/v1/feed-posts') ? new Promise((r) => { finish = () => r({ data: { data: POSTS } }); }) : slow(url)));
    const btn = screen.getByTestId('home-refresh');
    fireEvent.click(btn);
    await waitFor(() => expect(btn.textContent).toBe('Refreshing…'));
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('Loading your workspace…')).toBeNull();
    expect(screen.getByText('Which bag?')).toBeTruthy();
    fireEvent.click(btn);
    await waitFor(() => expect(typeof finish).toBe('function'));
    finish();
    await waitFor(() => expect(btn.textContent).toBe('Refresh'));
    expect(calls('/api/v1/feed-posts')).toBe(2);
  });

  test('a card whose read fails on refresh keeps what it showed', async () => {
    renderHome();
    await screen.findByText('Which bag?');
    vi.mocked(apiClient.get).mockImplementation(answerFor({ '/api/v1/feed-posts': new Error('offline') }));
    fireEvent.click(screen.getByTestId('home-refresh'));
    await waitFor(() => expect(screen.getByTestId('home-refresh').textContent).toBe('Refresh'));
    expect(screen.getByText('Which bag?')).toBeTruthy();
  });
});
