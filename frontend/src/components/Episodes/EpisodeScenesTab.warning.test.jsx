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
    // The plan loaded; its Pulse-moment check could not be made (the server says so in the plan's answer).
    planResponse({ feed_moment_missing: [], feed_moment_check_error: 'Network Error' });

    renderTab();

    expect((await screen.findByRole('alert')).textContent)
      .toContain("Could not check whether this episode's Pulse moments were saved: Network Error");
  });

  // The plan request itself failing is a different thing (2026-11-12): the
  // page says the beats didn't load, with Retry, and shows no Pulse warning.
  test('a plan that did not load is said as that, not as a Pulse-moments warning', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.endsWith('/plan')) return Promise.reject(new Error('Network Error'));
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderTab();

    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't load this episode's beats.");
    expect(screen.queryByText(/Could not check whether this episode's Pulse moments were saved/)).toBeNull();
  });

  // S1-A (Evoni, 2026-11-25): the same surface carries what the scene
  // synchronization held or could not resolve, following the
  // feed_moment_missing precedent — the plan's answer reports it (the beat
  // save's and generate-plan's answers carry the same scene_sync shape) and
  // the tab names those beats. Nothing is stored for it.
  describe('scene synchronization warnings (S1-A)', () => {
    const REMOVED = 'A scene associated with this beat was removed previously. '
      + 'Automatic synchronization will not recreate it. Review the beat if a scene is expected.';

    test('names the beats whose scene was removed previously, in Evoni\'s words', async () => {
      planResponse({ scene_sync: { outcome: 'held', warnings: [
        { beat_number: 3, code: 'scene_removed_previously_ambiguous', text: REMOVED },
        { beat_number: 7, code: 'scene_removed_previously_ambiguous', text: REMOVED },
      ] } });

      renderTab();

      const alert = await screen.findByTestId('est-scene-removed-previously');
      expect(alert.getAttribute('role')).toBe('alert');
      expect(alert.textContent).toContain(REMOVED);
      expect(alert.textContent).toContain('Beats 3 and 7.');
      // It claims nothing about who removed the scene, or how.
      expect(alert.textContent).not.toMatch(/manual|by hand|deleted by|operator removed/i);
      // And nothing about the scene being required.
      expect(alert.textContent).not.toMatch(/required|must be|needed for/i);
    });

    test('a single beat reads in the singular', async () => {
      planResponse({ scene_sync: { outcome: 'held', warnings: [
        { beat_number: 5, code: 'scene_removed_previously_ambiguous', text: REMOVED },
      ] } });

      renderTab();

      expect((await screen.findByTestId('est-scene-removed-previously')).textContent).toContain('Beat 5.');
    });

    test('a removal with live production records reads as the stronger review warning', async () => {
      planResponse({ scene_sync: { outcome: 'held', warnings: [
        { beat_number: 4, code: 'scene_removed_previously_with_linked_work', text: REMOVED },
      ] } });

      renderTab();

      const alert = await screen.findByTestId('est-scene-removed-previously');
      expect(alert.textContent).toContain(REMOVED);
      expect(alert.textContent).toContain('Production records are still linked to the removed scene for beat 4');
      // Linked work is not a claim that the scene belongs in the episode.
      expect(alert.textContent).not.toMatch(/required|restore it|recreate the scene/i);
    });

    test('a beat the sync could not resolve says the episode cannot be exported yet', async () => {
      planResponse({ scene_sync: { outcome: 'unresolved', warnings: [
        { beat_number: 3, code: 'scene_number_conflict', scene_number: 3 },
        { beat_number: 9, code: 'required_scene_missing' },
      ] } });

      renderTab();

      const alert = await screen.findByTestId('est-scene-unresolved');
      expect(alert.getAttribute('role')).toBe('alert');
      expect(alert.textContent).toContain('The scene for beats 3 and 9 could not be synchronized');
      expect(alert.textContent).toContain('cannot be exported until they are resolved');
      expect(screen.queryByTestId('est-scene-removed-previously')).toBeNull();
    });

    test('a retryable failure says to try again, and never that anything was removed', async () => {
      planResponse({ scene_sync: { outcome: 'retryable', warnings: [
        { beat_number: null, scope: 'episode', code: 'sync_failed_retryable' },
      ] } });

      renderTab();

      const alert = await screen.findByTestId('est-scene-sync-failed');
      expect(alert.textContent).toContain('Nothing was changed');
      expect(alert.textContent).toMatch(/retry/i);
    });

    test('a material failure says the list may be incomplete, and that nothing was removed', async () => {
      planResponse({ scene_sync: { outcome: 'failed', warnings: [
        { beat_number: null, scope: 'episode', code: 'sync_failed_material' },
      ] } });

      renderTab();

      expect((await screen.findByTestId('est-scene-sync-failed')).textContent)
        .toContain('may be incomplete. Nothing was removed.');
    });

    test('a beat the readiness surface already covers is not repeated here', async () => {
      // beat_no_location, beat_removed_set and beat_scene_set_incomplete are
      // already on the status bar and in the issues list.
      planResponse({ feed_moment_missing: [], scene_sync: { outcome: 'held', warnings: [
        { beat_number: 1, code: 'beat_no_location' },
        { beat_number: 2, code: 'beat_removed_set' },
        { beat_number: 3, code: 'beat_scene_set_incomplete' },
      ] } });

      renderTab();

      await waitFor(() => expect(screen.queryByText('Loading scenes...')).toBeNull());
      expect(screen.queryByTestId('est-scene-removed-previously')).toBeNull();
      expect(screen.queryByTestId('est-scene-unresolved')).toBeNull();
      expect(screen.queryByTestId('est-scene-sync-failed')).toBeNull();
    });

    test('an episode-scope removal holds no beat up and names none', async () => {
      planResponse({ scene_sync: { outcome: 'complete', warnings: [
        { beat_number: null, scope: 'episode', scene_number: 40, code: 'scene_removed_previously_with_linked_work' },
      ] } });

      renderTab();

      await waitFor(() => expect(screen.queryByText('Loading scenes...')).toBeNull());
      expect(screen.queryByTestId('est-scene-removed-previously')).toBeNull();
      expect(screen.queryByTestId('est-scene-unresolved')).toBeNull();
    });

    test('says nothing at all when the synchronization is complete', async () => {
      planResponse({ feed_moment_missing: [], scene_sync: { outcome: 'complete', warnings: [] } });

      renderTab();

      await waitFor(() => expect(screen.queryByText('Loading scenes...')).toBeNull());
      expect(screen.queryByRole('alert')).toBeNull();
    });

    test('a plan with no scene_sync at all shows no synchronization warning', async () => {
      planResponse({ feed_moment_missing: [] });

      renderTab();

      await waitFor(() => expect(screen.queryByText('Loading scenes...')).toBeNull());
      expect(screen.queryByTestId('est-scene-removed-previously')).toBeNull();
      expect(screen.queryByTestId('est-scene-sync-failed')).toBeNull();
    });
  });

  describe('Retry Pulse moments (Task #2220)', () => {
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
      fireEvent.click(await screen.findByRole('button', { name: 'Retry Pulse moments' }));

      expect((await screen.findByRole('status')).textContent).toBe('Saved the Pulse moment for beats 3 and 7.');
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
      fireEvent.click(await screen.findByRole('button', { name: 'Retry Pulse moments' }));

      expect((await screen.findByRole('status')).textContent).toBe('Saved 1 of 2. Still not saved for beat 7: db unavailable');
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('not saved for beat 7, so that beat has no feed moment.'));
    });

    test('the button is disabled while the retry runs', async () => {
      planSequence([5], [5]);
      let finish;
      vi.mocked(apiClient.post).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));

      renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Retry Pulse moments' }));

      const running = await screen.findByRole('button', { name: /Retrying/ });
      expect(running.disabled).toBe(true);
      finish({ data: { success: true, data: { attempted: 1, saved: 0, failed: [{ beat_number: 5, error: 'x' }] } } });
      expect(await screen.findByRole('button', { name: 'Retry Pulse moments' })).toBeTruthy();
    });

    test('a failed request says so in plain words', async () => {
      planSequence([5], [5]);
      vi.mocked(apiClient.post).mockRejectedValue(Object.assign(new Error('Request failed'), {
        response: { data: { error: "This episode's source event is gone, so its feed moments cannot be generated again." } },
      }));

      renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Retry Pulse moments' }));

      expect((await screen.findByRole('status')).textContent)
        .toBe("Could not retry the Pulse moments: This episode's source event is gone, so its feed moments cannot be generated again.");
    });
  });
});
