/**
 * The Beat Plan page when its reads fail (Evoni, 2026-11-12): it says so on
 * the page with Retry. It does not show "No scene plan yet", and it does not
 * offer Generate Scene Plan in answer to a failed read. A read that succeeds
 * with no plan keeps the empty state and Generate.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import ScenePlannerPage from './ScenePlannerPage';
import { PLAN_REFRESH_MS } from '../components/BeatPlan/usePlanRefresh';

const isPlan = (url) => url === '/api/v1/episode-brief/ep-1/plan';
const isBrief = (url) => url === '/api/v1/episode-brief/ep-1';
const reads = ({ fail }) => vi.mocked(api.get).mockImplementation(async (url) => {
  if (isPlan(url)) { if (fail) throw new Error('Network Error'); return { data: { data: [] } }; }
  if (isBrief(url)) return { data: { data: { episode_id: 'ep-1' } } };
  return { data: { data: [] } };
});
const renderPage = () => render(
  <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
    <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
  </MemoryRouter>,
);

describe('ScenePlannerPage: a failed read is not "no scene plan yet"', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('the read fails: an error with Retry; no empty state and no Generate', async () => {
    reads({ fail: true });
    renderPage();
    const failed = await screen.findByTestId('beat-plan-load-failed');
    expect(failed.textContent).toContain("Couldn't load the beat plan");
    // An ordinary failed read changed nothing, and must keep saying so.
    expect(failed.textContent).toContain('Nothing was changed.');
    expect(failed.textContent).not.toContain('was saved');
    expect(screen.queryByText('No scene plan yet')).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate Scene Plan/ })).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  test('Retry reads again; an empty plan then shows "No scene plan yet" and Generate, as before', async () => {
    reads({ fail: true });
    renderPage();
    await screen.findByTestId('beat-plan-load-failed');
    reads({ fail: false });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No scene plan yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Generate Scene Plan/ })).toBeTruthy();
    expect(screen.queryByTestId('beat-plan-load-failed')).toBeNull();
  });

  test('a first read that succeeds with no plan: the empty state and Generate, unchanged', async () => {
    reads({ fail: false });
    renderPage();
    expect(await screen.findByText('No scene plan yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Generate Scene Plan/ })).toBeTruthy();
    expect(screen.queryByTestId('beat-plan-load-failed')).toBeNull();
  });

  // A refresh that fails after the plan loaded (review follow-up, 2026-11-12).
  describe('a refresh that fails while a plan is showing', () => {
    const PLAN = [{ id: 'p5', beat_number: 5, beat_name: 'Beat 5', locked: false, scene_set_id: 'set-1', sceneSet: { id: 'set-1', name: "Lala's Closet", base_still_url: null },
      location: { role: 'home', kinds: [], angle: null, missing: null, generating: true, image: null } }];
    let planAnswer;
    afterEach(() => vi.useRealTimers());

    test('the plan stays, the page says it could not refresh with Retry, and Generate is not offered', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      planAnswer = 'ok';
      vi.mocked(api.get).mockImplementation(async (url) => {
        if (isPlan(url)) { if (planAnswer === 'fail') throw new Error('Network Error'); return { data: { data: PLAN } }; }
        if (isBrief(url)) return { data: { data: { episode_id: 'ep-1' } } };
        return { data: { data: [] } };
      });
      renderPage();
      await screen.findByTestId('beat-card-5');
      expect(screen.getByRole('button', { name: /Generate Scene Plan/ })).toBeTruthy();

      planAnswer = 'fail';
      await act(async () => { await vi.advanceTimersByTimeAsync(PLAN_REFRESH_MS + 50); });
      const failed = screen.getByTestId('beat-plan-load-failed');
      expect(failed.textContent).toContain("Couldn't refresh the beat plan");
      expect(failed.textContent).toContain('from the last successful load and may be out of date');
      // An ordinary refresh failure changed nothing either.
      expect(failed.textContent).toContain('Nothing was changed.');
      expect(failed.textContent).not.toContain('was saved');
      expect(screen.getByTestId('beat-card-5')).toBeTruthy();
      expect(screen.queryByText('No scene plan yet')).toBeNull();
      expect(screen.queryByRole('button', { name: /Generate Scene Plan/ })).toBeNull();

      planAnswer = 'ok';
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
      await screen.findByTestId('beat-card-5');
      expect(screen.queryByTestId('beat-plan-load-failed')).toBeNull();
      expect(screen.getByRole('button', { name: /Generate Scene Plan/ })).toBeTruthy();
    });
  });

  // A read that fails right after a generation that SAVED (Evoni, 2026-11-25).
  // "Nothing was changed" is false then: the plan was saved and only its
  // updated details could not be loaded. A generation that FAILED must still
  // never make the page claim a save.
  describe('a plan read that fails after a generation', () => {
    const PLAN = [{ id: 'p5', beat_number: 5, beat_name: 'Beat 5', locked: false,
      scene_set_id: 'set-1', sceneSet: { id: 'set-1', name: "Lala's Closet", base_still_url: null } }];
    // usePlanRefresh only polls while a beat is still generating.
    const GENERATING = [{ ...PLAN[0], location: { role: 'home', kinds: [], angle: null, missing: null, generating: true, image: null } }];
    let planAnswer;
    afterEach(() => vi.useRealTimers());

    const wire = () => vi.mocked(api.get).mockImplementation(async (url) => {
      if (isPlan(url)) { if (planAnswer === 'fail') throw new Error('Network Error'); return { data: { data: PLAN } }; }
      if (isBrief(url)) return { data: { data: { episode_id: 'ep-1' } } };
      return { data: { data: [] } };
    });
    const generate = async () => {
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Scene Plan|Re-plan/ })); });
    };

    test('the POST saved and the read failed: the banner says so, and never "Nothing was changed"', async () => {
      planAnswer = 'ok';
      wire();
      vi.mocked(api.post).mockImplementation(async () => { planAnswer = 'fail'; return { data: { success: true, data: PLAN, plan_changes: [] } }; });
      renderPage();
      await screen.findByTestId('beat-card-5');

      await generate();

      const failed = await screen.findByTestId('beat-plan-load-failed');
      expect(failed.textContent).toContain('The new plan was saved');
      expect(failed.textContent).toContain("updated details couldn't be loaded");
      expect(failed.textContent).not.toContain('Nothing was changed');
      // the stale plan is still shown, as it is for any failed refresh
      expect(screen.getByTestId('beat-card-5')).toBeTruthy();
    });

    test('a generation that failed never claims a plan was saved', async () => {
      // A 409 throws before the re-read, so no banner appears from the
      // generation itself. The next refresh that fails is an ORDINARY
      // failure, and must still say nothing was changed.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      planAnswer = 'ok';
      vi.mocked(api.get).mockImplementation(async (url) => {
        if (isPlan(url)) { if (planAnswer === 'fail') throw new Error('Network Error'); return { data: { data: GENERATING } }; }
        if (isBrief(url)) return { data: { data: { episode_id: 'ep-1' } } };
        return { data: { data: [] } };
      });
      vi.mocked(api.post).mockRejectedValue({
        response: { status: 409, data: { success: false, code: 'PLAN_OUTPUT_INVALID', error: 'The planner sent back 6 of the 14 beats.' } },
      });
      renderPage();
      await screen.findByTestId('beat-card-5');

      await generate();
      expect(screen.queryByTestId('beat-plan-load-failed')).toBeNull();

      planAnswer = 'fail';
      await act(async () => { await vi.advanceTimersByTimeAsync(PLAN_REFRESH_MS + 50); });

      const failed = screen.getByTestId('beat-plan-load-failed');
      expect(failed.textContent).not.toContain('was saved');
      expect(failed.textContent).toContain('Nothing was changed.');
      vi.useRealTimers();
    });

    test('a later successful read clears it, and a plain refresh failure says "Nothing was changed" again', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      planAnswer = 'ok';
      vi.mocked(api.get).mockImplementation(async (url) => {
        if (isPlan(url)) { if (planAnswer === 'fail') throw new Error('Network Error'); return { data: { data: GENERATING } }; }
        if (isBrief(url)) return { data: { data: { episode_id: 'ep-1' } } };
        return { data: { data: [] } };
      });
      vi.mocked(api.post).mockImplementation(async () => { planAnswer = 'fail'; return { data: { success: true, data: GENERATING, plan_changes: [] } }; });
      renderPage();
      await screen.findByTestId('beat-card-5');

      // saved, then the read failed
      await generate();
      expect((await screen.findByTestId('beat-plan-load-failed')).textContent).toContain('The new plan was saved');

      // a read that works clears both the banner and the saved-not-loaded state
      planAnswer = 'ok';
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
      await screen.findByTestId('beat-card-5');
      expect(screen.queryByTestId('beat-plan-load-failed')).toBeNull();

      // and a plain refresh failure, with no generation behind it, is ordinary again
      planAnswer = 'fail';
      await act(async () => { await vi.advanceTimersByTimeAsync(PLAN_REFRESH_MS + 50); });
      const failed = screen.getByTestId('beat-plan-load-failed');
      expect(failed.textContent).toContain('Nothing was changed.');
      expect(failed.textContent).not.toContain('was saved');
      vi.useRealTimers();
    });
  });
});
