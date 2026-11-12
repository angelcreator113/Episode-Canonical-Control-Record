/**
 * Scenes › Plan when the beats don't load (Evoni, 2026-11-12): it says so
 * with Retry, and does not say "No beat plan yet · Make the beat plan". A
 * read that succeeds with no beats keeps that empty state.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../../services/api';
import EpisodeScenesTab from './EpisodeScenesTab';
import { PLAN_REFRESH_MS } from '../BeatPlan/usePlanRefresh';

const others = { data: { success: true, data: [] } };
const planFails = () => vi.mocked(apiClient.get).mockImplementation((url) => (url.endsWith('/episode-brief/ep-1/plan') ? Promise.reject(new Error('Network Error')) : Promise.resolve(others)));
const planEmpty = () => vi.mocked(apiClient.get).mockImplementation((url) => Promise.resolve(url.endsWith('/episode-brief/ep-1/plan') ? { data: { data: [], count: 0 } } : others));
const renderTab = () => render(<MemoryRouter><EpisodeScenesTab episode={{ id: 'ep-1' }} /></MemoryRouter>);

describe('EpisodeScenesTab: a failed beats read is not "no beat plan yet"', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('the read fails: an error with Retry; "Make the beat plan" is not offered', async () => {
    planFails();
    renderTab();
    const failed = await screen.findByTestId('est-plan-failed');
    expect(failed.textContent).toContain("Couldn't load this episode's beats. Nothing was changed.");
    expect(screen.queryByText(/No beat plan yet/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Make the beat plan' })).toBeNull();
  });

  test('Retry reads again; an empty plan then shows "No beat plan yet" with its link, as before', async () => {
    planFails();
    renderTab();
    await screen.findByTestId('est-plan-failed');
    planEmpty();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/No beat plan yet/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Make the beat plan' }).getAttribute('href')).toBe('/episodes/ep-1/plan');
    expect(screen.queryByTestId('est-plan-failed')).toBeNull();
  });

  test('a first read that succeeds with no beats: the empty state, unchanged', async () => {
    planEmpty();
    renderTab();
    expect(await screen.findByText(/No beat plan yet/)).toBeTruthy();
    expect(screen.queryByTestId('est-plan-failed')).toBeNull();
  });

  // A refresh that fails after the beats loaded (review follow-up, 2026-11-12):
  // the beats stay, but the page says they may be out of date and offers Retry.
  describe('a refresh that fails while beats are showing', () => {
    // One beat still generating its image, so the page re-reads the plan.
    const BEATS = [{ id: 'p5', beat_number: 5, beat_name: 'Reveal', locked: false, scene_set_id: 'set-1', sceneSet: { id: 'set-1', name: "Lala's Closet" },
      location: { role: 'home', kinds: [], angle: null, missing: null, generating: true, image: null } }];
    const planLoads = (rows) => vi.mocked(apiClient.get).mockImplementation((url) => Promise.resolve(url.endsWith('/episode-brief/ep-1/plan') ? { data: { data: rows, count: rows.length } } : others));
    const planCalls = () => vi.mocked(apiClient.get).mock.calls.filter(([u]) => u.endsWith('/episode-brief/ep-1/plan')).length;
    afterEach(() => vi.useRealTimers());

    test('the beats stay, an error with Retry is shown, and neither empty nor first-load wording is used', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      planLoads(BEATS);
      renderTab();
      expect((await screen.findAllByText(/Reveal/)).length).toBeGreaterThan(0);
      expect(screen.queryByTestId('est-plan-stale')).toBeNull();
      const before = planCalls();

      planFails();
      await act(async () => { await vi.advanceTimersByTimeAsync(PLAN_REFRESH_MS + 50); });
      expect(planCalls()).toBe(before + 1);
      const stale = screen.getByTestId('est-plan-stale');
      expect(stale.getAttribute('role')).toBe('alert');
      expect(stale.textContent).toContain("Couldn't refresh this episode's beats. What's shown is from the last successful load and may be out of date.");
      // The beats from the last good read are still there; the page does not call the episode empty.
      expect(screen.getAllByText(/Reveal/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/No beat plan yet/)).toBeNull();
      expect(screen.queryByTestId('est-plan-failed')).toBeNull();

      // Retry reads again; a good answer clears the note.
      planLoads(BEATS);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
      expect((await screen.findAllByText(/Reveal/)).length).toBeGreaterThan(0);
      expect(screen.queryByTestId('est-plan-stale')).toBeNull();
    });
  });
});
