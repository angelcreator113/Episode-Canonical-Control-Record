/**
 * The Episode page's production-checklist state (the loading-state fix,
 * 2026-11-19): loading, failed and partly unreadable are said as such, and
 * the checks always belong to the episode on the page. The page, its
 * Overview, the Checklist tab and the loader are the real ones; only the
 * HTTP client, the auth context and the toast hook are replaced.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn(), defaults: {} },
}));
const { auth, mockToast } = vi.hoisted(() => ({
  auth: { user: null },
  mockToast: { showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn(), showWarning: vi.fn() },
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user, isAuthenticated: true, loading: false }) }));
vi.mock('../components/ToastContainer', () => ({ useToast: () => mockToast }));
// The real loader, with the page's calls on record so one can be made to fail outright.
vi.mock('../components/Episodes/EpisodeProductionChecklist', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, loadProductionChecks: vi.fn((...args) => real.loadProductionChecks(...args)) };
});

import apiClient from '../services/api';
import EpisodeDetail from './EpisodeDetail';
import { loadProductionChecks } from '../components/Episodes/EpisodeProductionChecklist';
import { resetVoiceStudioStatus } from '../lib/voiceStudioApi';
import { createRequestLedger, normalizeUrl } from '../test/requestLedger';
import { ADMIN, EDITOR, EP_FULL, EP_BARE, episodeAnswers } from './EpisodeDetail.requests.fixtures';

const planOf = (id) => `/api/v1/episode-brief/${id}/plan`;
const brainUrl = '/api/v1/franchise-brain/entries?category=franchise_law&limit=1&status=active';

function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const PLAN_BODY = { data: { data: [], coverage: null, readiness: null } };

let go;
function Nav() { go = useNavigate(); return null; }

describe('Episode page: the production checklist is loading, failed, partly unreadable or ready, and always this episode\'s', () => {
  let ledger;
  let instead; // (key) => promise | undefined, replaceable mid-test

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.clear();
    resetVoiceStudioStatus();
    instead = () => undefined;
    ledger = createRequestLedger();
    ledger.watchFetch();
  });
  afterEach(() => { cleanup(); ledger.restore(); vi.restoreAllMocks(); });

  function open(id, user, tab) {
    auth.user = user;
    const samples = {};
    ledger.attach(apiClient, (url) => {
      const key = normalizeUrl(url);
      const own = instead(key);
      if (own !== undefined) return own;
      const of = /([0-9a-f]{8}-[0-9a-f-]{27})/.exec(key)?.[1];
      const which = of === EP_FULL || of === EP_BARE ? of : id;
      samples[which] = samples[which] || episodeAnswers(which);
      return samples[which].answer(url);
    });
    return render(
      <MemoryRouter initialEntries={[`/episodes/${id}${tab ? `?tab=${tab}` : ''}`]}>
        <Nav />
        <Routes><Route path="/episodes/:episodeId" element={<EpisodeDetail />} /></Routes>
      </MemoryRouter>,
    );
  }
  const meta = () => screen.queryByTestId('overview-next-step-meta')?.textContent ?? null;
  const badge = () => screen.queryByTestId('ed-production-left');
  const goButton = () => screen.queryByTestId('overview-next-step-go');
  const stepText = () => screen.getByTestId('overview-next-step').textContent;
  const counted = async () => { await waitFor(() => expect(meta()).toMatch(/^Production checklist: \d+ of \d+ /)); return meta(); };

  test('while the checklist is out: "checking…", no badge, no count and no next-step button; then the count and the button', async () => {
    const plan = deferred();
    instead = (key) => (key === planOf(EP_FULL) ? plan.promise : undefined);
    open(EP_FULL, ADMIN);
    await screen.findByTestId('overview-next-step');
    await waitFor(() => expect(meta()).toBe('Production checklist: checking…'));
    expect(stepText()).toContain('Checking the production checklist…');
    expect(goButton()).toBeNull();
    expect(badge()).toBeNull();
    await act(async () => { plan.resolve(PLAN_BODY); });
    expect(await counted()).toMatch(/^Production checklist: \d+ of \d+ done$/);
    expect(goButton().textContent).toContain('Open Checklist');
    expect(badge().textContent).toMatch(/^\d+ left$/);
    expect(badge().getAttribute('aria-label')).toMatch(/^\d+ left$/);
    expect(badge().getAttribute('title')).toBeNull();
  });

  test('every read answers, some with nothing: the plain count, and a badge that says only "N left"', async () => {
    open(EP_BARE, EDITOR);
    expect(await counted()).toMatch(/^Production checklist: \d+ of \d+ done$/);
    expect(badge().getAttribute('aria-label')).toMatch(/^\d+ left$/);
  });

  test('two reads fail: the line gives three numbers that add up, the badge keeps "N left" and says how many could not be checked', async () => {
    instead = (key) => (key === planOf(EP_FULL) || key === brainUrl ? Promise.reject(new Error('Network Error')) : undefined);
    open(EP_FULL, ADMIN);
    const line = await counted();
    // The plan's two checks and the Show Brain's one; "Scene sets assigned" is ticked from the event's own set.
    const m = /^Production checklist: (\d+) of (\d+) verified complete · (\d+) incomplete · (\d+) couldn't be checked\. Open the Checklist tab to check again\.$/.exec(line);
    expect(m).not.toBeNull();
    const [done, total, incomplete, unreadable] = m.slice(1).map(Number);
    expect(unreadable).toBe(3);
    expect(done + incomplete + unreadable).toBe(total);
    expect(badge().textContent).toBe(`${incomplete + unreadable} left`);
    expect(badge().getAttribute('aria-label')).toBe(`${incomplete + unreadable} left, 3 couldn't be checked`);
    expect(badge().getAttribute('title')).toBe("3 of these couldn't be checked");
    // The loader's own count is what it always was.
    const { checks } = await loadProductionChecks.mock.results[0].value;
    expect(Object.values(checks).filter(Boolean).length).toBe(done);
    expect(stepText()).not.toContain('Complete the episode');
  });

  test("an episode with no show: the show's reads that cannot answer are not called unreadable; the plain count", async () => {
    const noShow = { id: EP_BARE, title: 'A Quiet Week', show_id: null, show: null, status: 'draft', episode_number: 2, script_content: '(Beat 1) Lala waits.', script_locked_beats: [] };
    instead = (key) => {
      if (key === `/api/v1/episodes/${EP_BARE}`) return Promise.resolve({ data: { data: noShow } });
      // With no show these two are asked with no show id and are refused.
      if (/show_id=(undefined|null)/.test(key)) return Promise.reject(new Error('Request failed with status code 400'));
      return undefined;
    };
    open(EP_BARE, EDITOR);
    expect(await counted()).toMatch(/^Production checklist: \d+ of \d+ done$/);
    expect(badge().getAttribute('aria-label')).toMatch(/^\d+ left$/);
    const { read } = await loadProductionChecks.mock.results[0].value;
    expect('slotCoverage' in read).toBe(false);
    expect('linkedEvent' in read).toBe(false);
  });

  test('the loader cannot run at all: said on the Overview, with the Checklist tab to check again; no badge and no count', async () => {
    vi.mocked(loadProductionChecks).mockImplementationOnce(() => Promise.reject(new Error('chunk failed')));
    open(EP_FULL, ADMIN);
    await waitFor(() => expect(meta()).toBe("Production checklist: couldn't be checked. Open the Checklist tab to check again."));
    expect(stepText()).toContain('Work through production');
    expect(goButton().textContent).toContain('Open Checklist');
    expect(badge()).toBeNull();
    expect(screen.queryByTestId('ed-checklist-count')).toBeNull();
    expect(console.error).toHaveBeenCalledWith('[EpisodeDetail] production checks load failed:', expect.any(Error));
  });

  test("another episode: nothing of the first one's badge, count, line or next step is shown while the new one's checklist is out", async () => {
    open(EP_FULL, ADMIN);
    const first = await counted();
    expect(badge()).not.toBeNull();
    const plan = deferred();
    instead = (key) => (key === planOf(EP_BARE) ? plan.promise : undefined);
    await act(async () => { go(`/episodes/${EP_BARE}`); });
    expect((await screen.findAllByText('A Quiet Week')).length).toBeGreaterThan(0);
    await screen.findByTestId('overview-next-step');
    await waitFor(() => expect(meta()).toBe('Production checklist: checking…'));
    expect(badge()).toBeNull();
    expect(goButton()).toBeNull();
    expect(stepText()).toContain('Checking the production checklist…');
    await act(async () => { plan.resolve(PLAN_BODY); });
    const second = await counted();
    expect(second).not.toBe(first);
    expect(loadProductionChecks.mock.calls[1][0].id).toBe(EP_BARE);
  });

  test("the first episode's checklist answers after she has moved on (the page's run and the Checklist tab's): the new episode's numbers stand", async () => {
    const plan = deferred();
    instead = (key) => (key === planOf(EP_FULL) ? plan.promise : undefined);
    open(EP_FULL, ADMIN, 'checklist');
    // Both the page's run and the Checklist tab's own are waiting on the plan.
    await waitFor(() => expect(ledger.counts()[`GET ${planOf(EP_FULL)}`]).toBe(2));
    await act(async () => { go(`/episodes/${EP_BARE}`); });
    const bare = await counted();
    const bareBadge = badge().textContent;
    await act(async () => { plan.reject(new Error('Network Error')); });
    await ledger.settle();
    expect(meta()).toBe(bare);
    expect(bare).toMatch(/done$/);
    expect(badge().textContent).toBe(bareBadge);
    expect(badge().getAttribute('aria-label')).toBe(bareBadge);
  });

  test("the Checklist tab's Check again reports what it could read: the badge and the Overview line follow it, with no second loader on the page", async () => {
    open(EP_FULL, ADMIN, 'checklist');
    const again = await screen.findByRole('button', { name: 'Check again' });
    await waitFor(() => expect(badge()?.getAttribute('aria-label')).toMatch(/^\d+ left$/));
    await waitFor(() => expect(again.disabled).toBe(false));
    await ledger.settle();
    instead = (key) => (key === planOf(EP_FULL) ? Promise.reject(new Error('Network Error')) : undefined);
    fireEvent.click(again);
    await waitFor(() => expect(badge().getAttribute('aria-label')).toMatch(/^\d+ left, 2 couldn't be checked$/));
    expect(loadProductionChecks).toHaveBeenCalledTimes(1); // the page's own run, once
    await act(async () => { go(`/episodes/${EP_FULL}`); });
    await waitFor(() => expect(meta()).toMatch(/2 couldn't be checked\. Open the Checklist tab to check again\.$/));
    // Checked again with everything answering: the plain count is back.
    await act(async () => { go(`/episodes/${EP_FULL}?tab=checklist`); });
    instead = () => undefined;
    const button = await screen.findByRole('button', { name: 'Check again' });
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(badge().getAttribute('aria-label')).toMatch(/^\d+ left$/));
    expect(loadProductionChecks).toHaveBeenCalledTimes(1);
  });
});
