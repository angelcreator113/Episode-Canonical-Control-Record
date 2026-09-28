/**
 * EpisodeScenesTab warns when beats lost their feed moment at generation
 * (§8(w) P5 follow-up, Task #2216). The plan endpoint reports the beats in
 * feed_moment_missing; the tab names them, and says nothing when none are.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../../services/api';
import EpisodeScenesTab from './EpisodeScenesTab';

const planResponse = (body) => {
  vi.mocked(apiClient.get).mockImplementation((url) => {
    if (url.endsWith('/episode-brief/ep-1/plan')) return Promise.resolve({ data: { data: [], count: 0, ...body } });
    return Promise.resolve({ data: { success: true, data: [] } });
  });
};

const renderTab = () => render(
  <MemoryRouter>
    <EpisodeScenesTab episode={{ id: 'ep-1' }} />
  </MemoryRouter>
);

describe('EpisodeScenesTab feed moment warning', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  test('names the beats whose feed moment was not saved', async () => {
    planResponse({ feed_moment_missing: [3, 7, 12] });

    renderTab();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('not saved for beats 3, 7 and 12');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan');
  });

  test('a single missing beat reads in the singular', async () => {
    planResponse({ feed_moment_missing: [5] });

    renderTab();

    expect((await screen.findByRole('alert')).textContent).toContain('not saved for beat 5, so that beat has no');
  });

  test('shows no warning when every feed moment was saved', async () => {
    planResponse({ feed_moment_missing: [] });

    renderTab();

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan'));
    await waitFor(() => expect(screen.queryByText('Loading scenes...')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('says so when the check itself fails, rather than showing nothing', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.endsWith('/plan')) return Promise.reject(new Error('Network Error'));
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderTab();

    expect((await screen.findByRole('alert')).textContent)
      .toContain("Could not check whether this episode's feed moments were saved: Network Error");
  });
});
