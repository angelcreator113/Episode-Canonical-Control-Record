/**
 * SocialProfileGenerator — what a person sees when the server keeps Feed
 * generation and the automation settings for an admin (Evoni, 2026-11-22).
 *
 * POST /feed-scheduler/auto-generate-job and PUT /feed-scheduler/config
 * answer a signed-in account outside the admin group with 403
 * AUTH_GROUP_REQUIRED, whose own words are "Forbidden". The page shows one
 * sentence instead. A setting outside the server's limits is a 400 with the
 * server's sentence, which the page shows as it is. Display only: the
 * controls are not hidden and the server is the guard.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

vi.mock('../components/FeedBulkImport', () => ({ default: () => null }));
vi.mock('./feed/ProfileCard', () => ({ default: () => null }));
vi.mock('./feed/ProfileDetailPanel', () => ({
  DetailPanel: () => null,
  FeedStatePicker: () => null,
}));
vi.mock('./feed/FeedEnhancements', () => ({
  ProfileComparison: () => null,
  LalaReactions: () => null,
  FeedTimeline: () => null,
  RelationshipWeb: () => null,
}));
// The Automation panel's batch-size select calls updateAutoConfig; this
// stand-in calls it the same way.
vi.mock('./feed/FeedViews', () => ({
  default: ({ updateAutoConfig }) => (
    <button onClick={() => updateAutoConfig({ batch_size: 10 })}>save batch size</button>
  ),
}));

import apiClient from '../services/api';
import SocialProfileGenerator from './SocialProfileGenerator';

const SENTENCE = 'Only an admin can generate Feed creators or change the Feed automation settings.';
const forbidden = () => Object.assign(new Error('Request failed with status code 403'), {
  response: { status: 403, data: { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' } },
});
const LIMIT_MSG = 'batch_size must be a whole number from 1 to 20. Nothing was changed.';
const outOfBounds = () => Object.assign(new Error('Request failed with status code 400'), {
  response: { status: 400, data: { success: false, code: 'INVALID_SCHEDULER_CONFIG', error: LIMIT_MSG, message: LIMIT_MSG, fields: ['batch_size'] } },
});

const renderPage = () => render(<MemoryRouter><SocialProfileGenerator /></MemoryRouter>);
const generateButton = () => screen.findByRole('button', { name: /Generate 5 Creators/ });

describe('SocialProfileGenerator — Feed generation and automation settings are an admin\'s', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    localStorage.clear();
  });

  test('auto-generate refused with 403: the admin-only sentence, not "Forbidden"', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(forbidden());
    renderPage();
    fireEvent.click(await generateButton());
    await waitFor(() => expect(screen.getAllByText(SENTENCE).length).toBeGreaterThan(0));
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/feed-scheduler/auto-generate-job', expect.objectContaining({ count: 5 }));
    expect(screen.queryByText('Forbidden')).toBeNull();
    // The control is still there: nothing is hidden from a non-admin.
    expect(await generateButton()).toBeTruthy();
  });

  test('auto-generate failing another way keeps the server\'s own words', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(Object.assign(new Error('x'), {
      response: { status: 409, data: { error: 'Feed cap reached (443/443). Delete or exempt profiles to generate more.' } },
    }));
    renderPage();
    fireEvent.click(await generateButton());
    await waitFor(() => expect(screen.getAllByText(/Feed cap reached \(443\/443\)/).length).toBeGreaterThan(0));
    expect(screen.queryByText(SENTENCE)).toBeNull();
  });

  test('a config save refused with 403: the admin-only sentence', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(forbidden());
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'save batch size' }));
    await waitFor(() => expect(screen.getByText(SENTENCE)).toBeTruthy());
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/feed-scheduler/config', { batch_size: 10 });
    expect(screen.queryByText(/Forbidden/)).toBeNull();
  });

  test('a config save refused with 400: the server\'s sentence', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(outOfBounds());
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'save batch size' }));
    await waitFor(() => expect(screen.getByText(`Config update failed: ${LIMIT_MSG}`)).toBeTruthy());
    expect(screen.queryByText(SENTENCE)).toBeNull();
  });

  test('a config save that succeeds shows no error and reloads the status', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { config: { batch_size: 10 }, message: 'Configuration updated' } });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'save batch size' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/v1/feed-scheduler/status'));
    expect(screen.queryByText(SENTENCE)).toBeNull();
    expect(screen.queryByText(/Config update failed/)).toBeNull();
  });
});
