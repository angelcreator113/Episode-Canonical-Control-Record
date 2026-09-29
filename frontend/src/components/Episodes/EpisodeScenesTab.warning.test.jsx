/**
 * EpisodeScenesTab warns when beats lost their feed moment at generation
 * (§8(w) P5 follow-up, Task #2216). The plan endpoint reports the beats in
 * feed_moment_missing; the tab names them, and says nothing when none are.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    expect(alert.textContent).toContain('not saved for beats 3, 7 and 12, so those beats have no feed moment.');
    // Regenerating supersedes the whole episode, so the warning does not suggest it.
    expect(alert.textContent).not.toMatch(/regenerat/i);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan');
  });

  test('a single missing beat reads in the singular', async () => {
    planResponse({ feed_moment_missing: [5] });

    renderTab();

    expect((await screen.findByRole('alert')).textContent).toContain('not saved for beat 5, so that beat has no feed moment.');
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

  describe('Retry feed moments (Task #2220)', () => {
    // The plan reports `before` until the retry has run, then `after`.
    const planSequence = (before, after) => {
      let retried = false;
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url.endsWith('/episode-brief/ep-1/plan')) {
          return Promise.resolve({ data: { data: [], count: 0, feed_moment_missing: retried ? after : before } });
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });
      return () => { retried = true; };
    };

    beforeEach(() => {
      vi.mocked(apiClient.post).mockReset();
    });

    test('retries the missing beats, then clears the warning and says what was saved', async () => {
      const markRetried = planSequence([3, 7], []);
      vi.mocked(apiClient.post).mockImplementation(async () => {
        markRetried();
        return { data: { success: true, data: { attempted: 2, saved: 2, failed: [] }, feed_moment_missing: [] } };
      });

      renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Retry feed moments' }));

      expect((await screen.findByRole('status')).textContent).toBe('Saved the feed moment for beats 3 and 7.');
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/feed-moments/retry');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    test('a beat that fails again stays in the warning and the reason is shown', async () => {
      const markRetried = planSequence([3, 7], [7]);
      vi.mocked(apiClient.post).mockImplementation(async () => {
        markRetried();
        return { data: { success: true, data: { attempted: 2, saved: 1, failed: [{ beat_number: 7, error: 'db unavailable' }] } } };
      });

      renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Retry feed moments' }));

      expect((await screen.findByRole('status')).textContent).toBe('Saved 1 of 2. Still not saved for beat 7: db unavailable');
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('not saved for beat 7, so that beat has no feed moment.'));
    });

    test('the button is disabled while the retry runs', async () => {
      planSequence([5], [5]);
      let finish;
      vi.mocked(apiClient.post).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));

      renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Retry feed moments' }));

      const running = await screen.findByRole('button', { name: /Retrying/ });
      expect(running.disabled).toBe(true);
      finish({ data: { success: true, data: { attempted: 1, saved: 0, failed: [{ beat_number: 5, error: 'x' }] } } });
      expect(await screen.findByRole('button', { name: 'Retry feed moments' })).toBeTruthy();
    });

    test('a failed request says so in plain words', async () => {
      planSequence([5], [5]);
      vi.mocked(apiClient.post).mockRejectedValue(Object.assign(new Error('Request failed'), {
        response: { data: { error: "This episode's source event is gone, so its feed moments cannot be generated again." } },
      }));

      renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Retry feed moments' }));

      expect((await screen.findByRole('status')).textContent)
        .toBe("Could not retry the feed moments: This episode's source event is gone, so its feed moments cannot be generated again.");
    });
  });
});
