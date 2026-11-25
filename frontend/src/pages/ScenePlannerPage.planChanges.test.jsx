/**
 * Gap 2 (Evoni, 2026-11-25): POST generate-plan answers with `plan_changes`,
 * naming the beats whose generated fields changed and saying whether each one
 * carries saved work. The page showed none of it — the response was read for
 * its length and thrown away.
 *
 * It is information, not a fault: the plan saved, the scenes and the
 * operator's own writing were kept, and nothing asks for a decision. So it
 * follows the readiness line's register and must never be an alert. It is
 * stored nowhere, so it lives in the page's own state: a background refresh
 * keeps it, a reload loses it, and a new attempt drops it at once.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import ScenePlannerPage from './ScenePlannerPage';
import { PLAN_REFRESH_MS } from '../components/BeatPlan/usePlanRefresh';

const HOME = { id: 'set-home', name: 'Lala apartment', base_still_url: 'https://x/home.jpg' };
const VENUE = { id: 'set-venue', name: 'Glasshouse', base_still_url: 'https://x/venue.jpg' };

const beat = (n, set, extra = {}) => ({
  id: `p${n}`, beat_number: n, beat_name: `Beat ${n}`,
  scene_set_id: set ? set.id : null, sceneSet: set || null,
  locked: false, chosen_by_user: false, ai_suggested: true, ...extra,
});

/** Before: beats 2,4,5 at the apartment. After: 2 and 4 at the Glasshouse. */
const PLAN_BEFORE = [beat(2, HOME), beat(4, HOME), beat(5, HOME), beat(6, HOME)];
const PLAN_AFTER = [beat(2, VENUE), beat(4, VENUE), beat(5, HOME), beat(6, HOME)];

let plan = PLAN_BEFORE;
let readiness = null;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
      <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
    </MemoryRouter>
  );
}

const wireGets = () => vi.mocked(api.get).mockImplementation(async (url) => {
  if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
  if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: plan, readiness } };
  if (url === '/api/v1/episodes/ep-1/locations') return { data: { success: true, data: { show_id: 'show-1', locations: [] } } };
  return { data: {} };
});

/** The POST answers with these changes, and the next plan read returns `after`. */
const wirePost = (plan_changes, after = PLAN_AFTER) => vi.mocked(api.post).mockImplementation(async () => {
  plan = after;
  return { data: { success: true, data: after, plan_changes } };
});

/** How many times the plan itself has been read. */
const planReads = () => vi.mocked(api.get).mock.calls.filter((c) => c[0] === '/api/v1/episode-brief/ep-1/plan').length;

const generate = async () => {
  const button = await screen.findByRole('button', { name: /Generate Scene Plan|Re-plan/ });
  await act(async () => { fireEvent.click(button); });
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  plan = PLAN_BEFORE;
  readiness = null;
  wireGets();
});

describe('ScenePlannerPage: what the last re-plan changed (Gap 2)', () => {
  test('a location change on a beat with saved work is named, with was-showing and now, and says the work was kept', async () => {
    wirePost([{ beat_number: 4, changed: ['scene_set_id'], has_saved_work: true }]);
    renderPage();
    await screen.findByTestId('beat-card-4');
    await generate();

    const notice = await screen.findByTestId('planner-plan-changes');
    expect(notice.textContent).toContain('Beat 4 changed location in this plan.');
    // "Was showing" is what was on screen, never claimed as stored history.
    expect(within(notice).getByTestId('planner-plan-change-4').textContent)
      .toBe('Beat 4 — was showing Lala apartment, now Glasshouse');
    expect(within(notice).getByTestId('planner-plan-changes-work').textContent)
      .toContain('Beat 4 has saved work, which was kept');
    expect(within(notice).getByRole('link', { name: 'Check them on the Beat Plan →' }).getAttribute('href'))
      .toBe('/episodes/ep-1?tab=beatplan');
  });

  test('a location change with no saved work is named without the saved-work sentence', async () => {
    wirePost([{ beat_number: 2, changed: ['scene_set_id'], has_saved_work: false }]);
    renderPage();
    await screen.findByTestId('beat-card-2');
    await generate();

    const notice = await screen.findByTestId('planner-plan-changes');
    expect(notice.textContent).toContain('Beat 2 changed location in this plan.');
    expect(screen.queryByTestId('planner-plan-changes-work')).toBeNull();
    // has_saved_work false establishes no live tied scene with an image and no
    // director note, feed moment or script lines. The notice must not claim a
    // saved scene or an edit was kept, because none is established.
    expect(notice.textContent).not.toMatch(/scenes? .*(kept|preserved)/i);
    expect(notice.textContent).not.toMatch(/edits? .*(kept|preserved)/i);
    expect(notice.textContent).not.toContain('was kept');
  });

  test('operator wording that was kept is reported as kept, not as a location change', async () => {
    wirePost([{ beat_number: 5, changed: ['operator_fields_kept'], has_saved_work: true }]);
    renderPage();
    await screen.findByTestId('beat-card-5');
    await generate();

    const notice = await screen.findByTestId('planner-plan-changes');
    expect(notice.textContent).toContain('Beat 5 kept your wording.');
    expect(notice.textContent).not.toContain('changed location');
    // nothing was applied, so there is no was/now line to show
    expect(screen.queryByTestId('planner-plan-change-5')).toBeNull();
    expect(within(screen.getByTestId('beat-card-5')).getByTestId('beat-changed-5').textContent)
      .toBe('Your wording kept');
  });

  test('a beat with saved work that did not change is not named and carries no tag', async () => {
    // Beat 6 has saved work but the server does not report it: it did not change.
    wirePost([{ beat_number: 4, changed: ['scene_set_id'], has_saved_work: true }]);
    renderPage();
    await screen.findByTestId('beat-card-6');
    await generate();

    await screen.findByTestId('planner-plan-changes');
    expect(screen.getByTestId('planner-plan-changes').textContent).not.toContain('Beat 6');
    expect(within(screen.getByTestId('beat-card-6')).queryByTestId('beat-changed-6')).toBeNull();
  });

  test('the tag shows in the Board view and in the List view, with was-showing on its title', async () => {
    wirePost([{ beat_number: 4, changed: ['scene_set_id'], has_saved_work: false }]);
    renderPage();
    await screen.findByTestId('beat-card-4');
    await generate();

    const board = within(await screen.findByTestId('beat-card-4')).getByTestId('beat-changed-4');
    expect(board.textContent).toBe('Location changed');
    expect(board.getAttribute('title')).toBe('Was showing: Lala apartment');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /List/ })); });
    const row = await screen.findByTestId('beat-changed-4');
    expect(row.textContent).toBe('Location changed');
    expect(row.getAttribute('title')).toBe('Was showing: Lala apartment');
  });

  test('an unresolvable previous name is left out rather than invented', async () => {
    // Beat 4 had no set before, so there is no name to show as "was showing".
    plan = [beat(2, HOME), beat(4, null), beat(5, HOME), beat(6, HOME)];
    wirePost([{ beat_number: 4, changed: ['scene_set_id'], has_saved_work: false }]);
    renderPage();
    await screen.findByTestId('beat-card-4');
    await generate();

    const line = within(await screen.findByTestId('planner-plan-changes')).getByTestId('planner-plan-change-4');
    expect(line.textContent).toBe('Beat 4');
    expect(line.textContent).not.toContain('was showing');
    expect(within(screen.getByTestId('beat-card-4')).getByTestId('beat-changed-4').getAttribute('title')).toBeNull();
  });

  test.each([
    ['an empty array', []],
    ['a missing field', undefined],
  ])('renders nothing for %s', async (_label, changes) => {
    wirePost(changes);
    renderPage();
    await screen.findByTestId('beat-card-4');
    await generate();

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(screen.queryByTestId('planner-plan-changes')).toBeNull();
    expect(screen.queryByTestId('beat-changed-4')).toBeNull();
  });

  test('a failed generation keeps the existing error behaviour and shows no stale notice', async () => {
    // First a successful generation, so there IS a notice to go stale.
    wirePost([{ beat_number: 4, changed: ['scene_set_id'], has_saved_work: true }]);
    renderPage();
    await screen.findByTestId('beat-card-4');
    await generate();
    await screen.findByTestId('planner-plan-changes');

    // Then a 409: nothing was written, so nothing is reported.
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { status: 409, data: { success: false, code: 'PLAN_OUTPUT_INVALID', error: 'The planner sent back 6 of the 14 beats.' } },
    });
    await generate();

    await waitFor(() => expect(screen.queryByTestId('planner-plan-changes')).toBeNull());
    expect(screen.getByText('The planner sent back 6 of the 14 beats.')).toBeTruthy();
    expect(screen.queryByTestId('beat-changed-4')).toBeNull();
  });

  test('a real background refresh updates the plan and does not erase the notice', async () => {
    // usePlanRefresh re-reads the plan every PLAN_REFRESH_MS while any beat
    // says what it waits on is still generating. So the generated plan has a
    // generating beat, which makes the refresh genuinely fire.
    // Fake timers for this case only, so the hook's interval can be advanced
    // deliberately; shouldAdvanceTime keeps the awaits above working.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const generatingAfter = [
      beat(2, VENUE), beat(4, VENUE, { location: { generating: true } }), beat(5, HOME), beat(6, HOME),
    ];
    wirePost([{ beat_number: 4, changed: ['scene_set_id'], has_saved_work: true }], generatingAfter);
    renderPage();
    await screen.findByTestId('beat-card-4');
    await generate();
    await screen.findByTestId('planner-plan-changes');

    const readsBefore = planReads();
    // The refresh's next read returns a CHANGED plan: beat 6 moves to the
    // Glasshouse and beat 4 has finished generating. If the notice were
    // derived from the plan rather than its own state, this would erase it.
    plan = [beat(2, VENUE), beat(4, VENUE), beat(5, HOME), beat(6, VENUE)];
    await act(async () => { vi.advanceTimersByTime(PLAN_REFRESH_MS); });

    // The refresh really happened: one more plan read, and the plan on screen
    // changed to prove the new data was applied.
    await waitFor(() => expect(planReads()).toBe(readsBefore + 1));
    await waitFor(() => expect(within(screen.getByTestId('beat-card-6')).getByText('Glasshouse')).toBeTruthy());

    // and the notice and its tag are still there
    expect(screen.getByTestId('planner-plan-changes')).toBeTruthy();
    expect(within(screen.getByTestId('beat-card-4')).getByTestId('beat-changed-4')).toBeTruthy();
    vi.useRealTimers();
  });

  test('the notice does not survive a remount, because nothing stores it', async () => {
    wirePost([{ beat_number: 4, changed: ['scene_set_id'], has_saved_work: true }]);
    const first = renderPage();
    await screen.findByTestId('beat-card-4');
    await generate();
    await screen.findByTestId('planner-plan-changes');
    first.unmount();

    renderPage();
    await screen.findByTestId('beat-card-4');
    expect(screen.queryByTestId('planner-plan-changes')).toBeNull();
  });

  test('the notice names the plan the generation produced, not the one it replaced', async () => {
    // The POST answers for beat 4; the plan read that follows is what the
    // notice must describe, so "now" is the new set, not the old one.
    wirePost([{ beat_number: 4, changed: ['scene_set_id'], has_saved_work: false }]);
    renderPage();
    await screen.findByTestId('beat-card-4');
    await generate();

    const line = within(await screen.findByTestId('planner-plan-changes')).getByTestId('planner-plan-change-4');
    expect(line.textContent).toContain('now Glasshouse');
    // the POST came first, then the re-read: the notice is set after both
    const order = [
      vi.mocked(api.post).mock.invocationCallOrder[0],
      ...vi.mocked(api.get).mock.calls
        .map((c, i) => (c[0] === '/api/v1/episode-brief/ep-1/plan' ? vi.mocked(api.get).mock.invocationCallOrder[i] : null))
        .filter((x) => x !== null),
    ];
    expect(order[order.length - 1]).toBeGreaterThan(order[0]);
  });

  test('it is information, not an alert: no role=alert and no error styling', async () => {
    wirePost([{ beat_number: 4, changed: ['scene_set_id'], has_saved_work: true }]);
    renderPage();
    await screen.findByTestId('beat-card-4');
    await generate();

    const notice = await screen.findByTestId('planner-plan-changes');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.className).toContain('scene-planner-plan-changes');
    expect(notice.className).not.toContain('error');
    // nothing blocks: Generate is still there to press again
    expect(screen.getByRole('button', { name: /Generate Scene Plan|Re-plan/ })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
