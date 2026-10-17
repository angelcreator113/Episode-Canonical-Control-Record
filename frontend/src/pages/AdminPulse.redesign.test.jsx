/**
 * Admin › The Pulse to Evoni's Admin mock (2026-10-17): the four numbers
 * across the top, the Director's card with Open The Pulse, and under Review,
 * Needs your attention (Review opens the section) and Recent activity.
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api';
import PulseDirector from './AdminPulse';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../services/showService', () => ({ default: { getAllShows: vi.fn(async () => [{ id: 'show-1', name: 'Styling Adventures' }]) } }));

const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const DRAFTS = [
  { id: 'd1', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'silk-charmeuse against unfinished drywall.', status: 'draft', release_state: 'scheduled', release_at: soon, created_at: new Date().toISOString(), comments: [] },
  { id: 'd2', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'learning to tell the difference.', status: 'draft', comments: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.includes('/comments/pending')) return { data: { data: [{ id: 'c1', handle: 'fan', text: 'This look!' }] } };
    if (url.includes('/pulse-followers/growth')) return { data: { line: [{ cause: 'start', change: 1000, count: 1000 }, { cause: 'episode', change: 140, count: 1140, label: 'Ep 1' }] } };
    if (url.includes('status=draft&from=wall')) return { data: { data: DRAFTS, total: 2 } };
    if (url.includes('/feed-posts')) return { data: { data: [], total: 0 } };
    return { data: {} };
  });
});

const renderAt = (url = '/admin?tab=pulse') => render(<MemoryRouter initialEntries={[url]}><PulseDirector /></MemoryRouter>);

describe('Admin › The Pulse redesign', () => {
  test('the four numbers', async () => {
    renderAt();
    const stats = await screen.findByTestId('pd-stats');
    expect(within(stats).getByTestId('pd-stat-scheduled').textContent).toContain('1Scheduled posts');
    expect(within(stats).getByTestId('pd-stat-drafts').textContent).toContain('2Drafts to release');
    expect(within(stats).getByTestId('pd-stat-comments').textContent).toContain('1Comments to review');
    expect(within(stats).getByTestId('pd-stat-growth').textContent).toContain('+14%');
    expect(within(stats).getByTestId('pd-stat-growth').textContent).toContain('1,140 followers · Ep 1');
  });

  test('the Director: Open The Pulse, and Review with its count', async () => {
    renderAt();
    expect(screen.getByRole('heading', { name: 'Social Director' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open The Pulse' }).getAttribute('href')).toBe('/pulse');
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Review/ }).textContent).toBe('Review (3)'));
  });

  test('Needs your attention opens Review; Recent activity lists the scheduled draft', async () => {
    renderAt('/admin?tab=pulse&sub=voices');
    await screen.findByTestId('pd-stats');
    expect(screen.queryByTestId('pd-attention')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /^Review/ }));
    const attention = await screen.findByTestId('pd-attention');
    expect(within(attention).getByTestId('pd-attention-drafts').textContent).toContain('2 drafts to release');
    expect(within(attention).getByTestId('pd-attention-comments').textContent).toContain('1 comment to review');
    fireEvent.click(within(within(attention).getByTestId('pd-attention-comments')).getByRole('button', { name: 'Review' }));
    expect(screen.getByRole('tab', { name: /^Review/ }).getAttribute('aria-selected')).toBe('true');
    const activity = screen.getByTestId('pd-activity');
    expect(within(activity).getAllByTestId('pd-activity-row')[0].textContent).toContain('Scheduled');
  });
});
