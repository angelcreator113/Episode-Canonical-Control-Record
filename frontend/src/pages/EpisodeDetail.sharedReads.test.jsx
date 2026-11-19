/**
 * The Episode page hands the production checklist's loader what it and its
 * Overview tab have already read (PR-08 of
 * docs/design/2026-11-studio-home-episode-command-center.md): the source
 * event from the header's read, the brief and the scene sets from the
 * Overview's. The loader is the real one, watched; only the HTTP client, the
 * auth context and the toast hook are replaced.
 *
 * What must hold: the checks are what the loader finds when it reads
 * everything itself; a read that failed, or that the checklist would read
 * differently, is not handed over; the loader never waits for ever; it runs
 * once per episode; nothing from another episode reaches it.
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
// The real loader, with its calls from the page on record. (The Checklist
// component calls the loader inside its own module, which this does not see.)
vi.mock('../components/Episodes/EpisodeProductionChecklist', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, loadProductionChecks: vi.fn((...args) => real.loadProductionChecks(...args)) };
});

import apiClient from '../services/api';
import EpisodeDetail from './EpisodeDetail';
import { loadProductionChecks } from '../components/Episodes/EpisodeProductionChecklist';
import { resetVoiceStudioStatus } from '../lib/voiceStudioApi';
import { createRequestLedger, normalizeUrl } from '../test/requestLedger';
import { ADMIN, EDITOR, EP_FULL, EP_BARE, EVENT_ID, SET_ID, SHOW_ID, episodeAnswers } from './EpisodeDetail.requests.fixtures';

const realLoader = async (...args) => (await vi.importActual('../components/Episodes/EpisodeProductionChecklist')).loadProductionChecks(...args);

const eventsOf = (id) => `/api/v1/episodes/${id}/events`;
const briefOf = (id) => `/api/v1/episode-brief/${id}`;
const setsOf = (id) => `/api/v1/episodes/${id}/scene-sets`;

/** A promise a test settles when it chooses. */
function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let go;
function Nav() { go = useNavigate(); return null; }

describe('Episode page: the checklist is handed what the page already read', () => {
  let ledger;
  let seen; // how many times each address has been asked, for "the first time only" answers

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.clear();
    resetVoiceStudioStatus();
    seen = {};
    ledger = createRequestLedger();
    ledger.watchFetch();
  });

  afterEach(() => {
    cleanup();
    ledger.restore();
    vi.restoreAllMocks();
  });

  /**
   * Renders the page. `instead(key, nth)` may answer an address itself (a
   * promise) for its nth asking; undefined leaves the sample answer.
   */
  function show(path, user, instead = () => undefined) {
    auth.user = user;
    const samples = {};
    ledger.attach(apiClient, (url) => {
      const key = normalizeUrl(url);
      seen[key] = (seen[key] || 0) + 1;
      const own = instead(key, seen[key]);
      if (own !== undefined) return own;
      const id = /^\/api\/v1\/(?:episodes|episode-brief)\/([0-9a-f-]{36})/.exec(key)?.[1]
        || /episode_id=([0-9a-f-]{36})/.exec(key)?.[1] || /\/episodes\/([0-9a-f-]{36})\/money/.exec(key)?.[1]
        || /\/wardrobe\/outfit\/([0-9a-f-]{36})/.exec(key)?.[1] || shownEpisode;
      samples[id] = samples[id] || episodeAnswers(id);
      return samples[id].answer(url);
    });
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Nav />
        <Routes><Route path="/episodes/:episodeId" element={<EpisodeDetail />} /></Routes>
      </MemoryRouter>,
    );
  }
  let shownEpisode;
  const open = (id, user, instead, tab) => { shownEpisode = id; return show(`/episodes/${id}${tab ? `?tab=${tab}` : ''}`, user, instead); };

  /** Waits for the page's nth loader run to finish and for the page to go quiet. */
  async function loaderRan(times = 1, { quiet = true } = {}) {
    await waitFor(() => expect(loadProductionChecks).toHaveBeenCalledTimes(times));
    const result = await loadProductionChecks.mock.results[times - 1].value;
    // `quiet: false` when a test is still holding an answer back.
    if (quiet) await ledger.settle();
    return result;
  }
  const loadedOf = (call = 0) => loadProductionChecks.mock.calls[call][2]?.loaded;
  const asked = (key) => ledger.counts()[`GET ${key}`] || 0;

  // ── What is handed over ───────────────────────────────────────────────
  test('a fully linked episode: the event, the brief and the scene sets are handed over, and each is asked for once less', async () => {
    open(EP_FULL, ADMIN);
    const result = await loaderRan();
    const loaded = loadedOf();
    expect(Object.keys(loaded).sort()).toEqual(['brief', 'linkedEvent', 'sceneSets']);
    expect(loaded.linkedEvent.id).toBe(EVENT_ID);
    expect(loaded.brief.id).toBe('brief-1');
    expect(loaded.sceneSets.map((s) => s.id)).toEqual([SET_ID]);
    expect(result.read.supplied.sort()).toEqual(['brief', 'linkedEvent', 'sceneSets']);
    expect(asked(eventsOf(EP_FULL))).toBe(2); // the header, the Overview
    expect(asked(briefOf(EP_FULL))).toBe(1); // the Overview
    expect(asked(setsOf(EP_FULL))).toBe(1); // the Overview
    // The venue's set is still read from the event that was handed over.
    expect(asked(`/api/v1/scene-sets/${SET_ID}`)).toBe(1);
    expect(loadProductionChecks).toHaveBeenCalledTimes(1);
  });

  test('a bare episode: "no event" and "no scene sets" are answers, and are handed over as such', async () => {
    open(EP_BARE, EDITOR);
    await loaderRan();
    const loaded = loadedOf();
    expect(loaded.linkedEvent).toBeNull();
    expect(loaded.brief.id).toBe('brief-2');
    expect(loaded.sceneSets).toEqual([]);
    expect(asked(eventsOf(EP_BARE))).toBe(2);
    expect(asked(briefOf(EP_BARE))).toBe(1);
    expect(asked(setsOf(EP_BARE))).toBe(1);
  });

  test.each([[EP_FULL, ADMIN], [EP_BARE, EDITOR]])('the checks, notes, coverage, scene step and event are what the loader finds reading everything itself (%s)', async (id, user) => {
    open(id, user);
    const shared = await loaderRan();
    const [episode, showId] = loadProductionChecks.mock.calls[0];
    const alone = await realLoader(episode, showId);
    expect(alone.read.supplied).toEqual([]);
    for (const field of ['checks', 'notes', 'coverage', 'sceneStep', 'linkedEvent']) expect(shared[field]).toEqual(alone[field]);
    const { supplied: _a, ...sharedRead } = shared.read;
    const { supplied: _b, ...aloneRead } = alone.read;
    expect(sharedRead).toEqual(aloneRead);
    expect(showId).toBe(SHOW_ID);
  });

  // ── A read that failed is never handed over ──────────────────────────
  test("the Overview's brief read fails: the brief is not handed over, the loader reads it, and the Overview still says so with Retry", async () => {
    open(EP_FULL, ADMIN, (key, nth) => (key === briefOf(EP_FULL) && nth === 1 ? Promise.reject(new Error('Network Error')) : undefined));
    await loaderRan();
    expect(Object.keys(loadedOf()).sort()).toEqual(['linkedEvent', 'sceneSets']);
    expect(asked(briefOf(EP_FULL))).toBe(2);
    expect((await screen.findByTestId('eov-load-failed')).textContent).toContain('the story brief');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  test("the Overview's scene-sets read fails: they are not handed over and the loader reads them", async () => {
    open(EP_FULL, ADMIN, (key, nth) => (key === setsOf(EP_FULL) && nth === 1 ? Promise.reject(new Error('Network Error')) : undefined));
    await loaderRan();
    expect(Object.keys(loadedOf()).sort()).toEqual(['brief', 'linkedEvent']);
    expect(asked(setsOf(EP_FULL))).toBe(2);
  });

  test("the header's events read fails: no event is handed over and the loader reads the events", async () => {
    open(EP_FULL, ADMIN, (key, nth) => (key === eventsOf(EP_FULL) && nth === 1 ? Promise.reject(new Error('Network Error')) : undefined));
    const result = await loaderRan();
    expect(Object.keys(loadedOf()).sort()).toEqual(['brief', 'sceneSets']);
    expect(asked(eventsOf(EP_FULL))).toBe(3);
    expect(result.linkedEvent.id).toBe(EVENT_ID);
  });

  test('every shared read fails: nothing is handed over and the loader reads all three', async () => {
    const shared = [eventsOf(EP_FULL), briefOf(EP_FULL), setsOf(EP_FULL)];
    open(EP_FULL, ADMIN, (key, nth) => (shared.includes(key) && nth === 1 ? Promise.reject(new Error('Network Error')) : undefined));
    await loaderRan();
    expect(loadedOf()).toEqual({});
    expect(asked(briefOf(EP_FULL))).toBe(2);
    expect(asked(setsOf(EP_FULL))).toBe(2);
  });

  // ── An answer the checklist would read differently is not handed over ─
  test('events linked but none flagged as the source: the header shows none, the checklist takes the first, so the loader reads them itself', async () => {
    const unflagged = { id: EVENT_ID, show_id: SHOW_ID, name: 'The Honey Table', scene_set_id: null };
    open(EP_FULL, ADMIN, (key) => (key === eventsOf(EP_FULL) ? Promise.resolve({ data: { events: [unflagged] } }) : undefined));
    const result = await loaderRan();
    expect('linkedEvent' in loadedOf()).toBe(false);
    expect(asked(eventsOf(EP_FULL))).toBe(3);
    expect(result.linkedEvent.id).toBe(EVENT_ID);
    expect(screen.queryByTestId('ed-source-event')).toBeNull();
  });

  test('an empty brief answer and scene sets under another name are not handed over', async () => {
    open(EP_FULL, ADMIN, (key) => {
      if (key === briefOf(EP_FULL)) return Promise.resolve({ data: null });
      if (key === setsOf(EP_FULL)) return Promise.resolve({ data: { sceneSets: [{ id: SET_ID }] } });
      return undefined;
    });
    await loaderRan();
    expect(Object.keys(loadedOf())).toEqual(['linkedEvent']);
    expect(asked(briefOf(EP_FULL))).toBe(2);
    expect(asked(setsOf(EP_FULL))).toBe(2);
  });

  // ── Waiting, and never for ever ──────────────────────────────────────
  test('on the Overview the loader waits for both reports, then runs once with both', async () => {
    const brief = deferred();
    open(EP_FULL, ADMIN, (key, nth) => (key === briefOf(EP_FULL) && nth === 1 ? brief.promise : undefined));
    await screen.findByTestId('overview-next-step');
    await waitFor(() => expect(asked(setsOf(EP_FULL))).toBe(1));
    await act(async () => { await new Promise((r) => { setTimeout(r, 20); }); });
    expect(loadProductionChecks).not.toHaveBeenCalled();
    await act(async () => { brief.resolve({ data: { data: { id: 'brief-late', episode_id: EP_FULL } } }); });
    await loaderRan();
    expect(loadedOf().brief.id).toBe('brief-late');
    expect(Object.keys(loadedOf()).sort()).toEqual(['brief', 'linkedEvent', 'sceneSets']);
    expect(asked(briefOf(EP_FULL))).toBe(1);
  });

  test('leaving the Overview before it has reported: the loader starts at once without it, and the late answer starts nothing', async () => {
    const brief = deferred();
    open(EP_FULL, ADMIN, (key, nth) => (key === briefOf(EP_FULL) && nth === 1 ? brief.promise : undefined));
    await screen.findByTestId('overview-next-step');
    expect(loadProductionChecks).not.toHaveBeenCalled();
    await act(async () => { go(`/episodes/${EP_FULL}?tab=distribution`); });
    await loaderRan(1, { quiet: false });
    expect('brief' in loadedOf()).toBe(false);
    expect(asked(briefOf(EP_FULL))).toBe(2); // the Overview's, still out, and the loader's own
    await act(async () => { brief.resolve({ data: { data: { id: 'brief-late', episode_id: EP_FULL } } }); });
    await ledger.settle();
    expect(loadProductionChecks).toHaveBeenCalledTimes(1);
  });

  test('a read the Overview could not even ask for is reported as failed, so the loader still runs', async () => {
    let thrown = false;
    open(EP_FULL, ADMIN);
    const answer = apiClient.get.getMockImplementation();
    apiClient.get.mockImplementation((url, ...rest) => {
      if (!thrown && normalizeUrl(url) === setsOf(EP_FULL)) { thrown = true; throw new Error('could not ask'); }
      return answer(url, ...rest);
    });
    await loaderRan();
    expect(thrown).toBe(true);
    expect(Object.keys(loadedOf())).toEqual(['linkedEvent']);
  });

  // ── Other tabs ───────────────────────────────────────────────────────
  test('opened on another tab: there is no Overview to wait for; only the event is handed over and the loader reads the brief and the scene sets', async () => {
    open(EP_FULL, ADMIN, undefined, 'distribution');
    await loaderRan();
    expect(Object.keys(loadedOf())).toEqual(['linkedEvent']);
    expect(asked(briefOf(EP_FULL))).toBe(1); // the loader
    expect(asked(setsOf(EP_FULL))).toBe(1); // the loader
    expect(asked(eventsOf(EP_FULL))).toBe(1); // the header
    expect(screen.queryByTestId('overview-next-step')).toBeNull();
    expect(await screen.findByTestId('ed-production-left')).toBeTruthy();
  });

  // ── Once per episode ─────────────────────────────────────────────────
  test("after the loader has run, the Overview's Retry, a visit to another tab and coming back start no second run", async () => {
    open(EP_FULL, ADMIN, (key, nth) => (key === briefOf(EP_FULL) && nth === 1 ? Promise.reject(new Error('Network Error')) : undefined));
    await loaderRan();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByTestId('eov-load-failed')).toBeNull());
    await ledger.settle();
    await act(async () => { go(`/episodes/${EP_FULL}?tab=distribution`); });
    await ledger.settle();
    await act(async () => { go(`/episodes/${EP_FULL}`); });
    await screen.findByTestId('overview-next-step');
    await ledger.settle();
    expect(loadProductionChecks).toHaveBeenCalledTimes(1);
  });

  // ── Another episode ──────────────────────────────────────────────────
  test('switching episode: each loader run gets its own episode\'s reads and nothing of the other\'s', async () => {
    open(EP_FULL, ADMIN);
    await loaderRan(1);
    await act(async () => { go(`/episodes/${EP_BARE}`); });
    await loaderRan(2);
    expect(loadProductionChecks.mock.calls[1][0].id).toBe(EP_BARE);
    expect(loadedOf(1).brief.id).toBe('brief-2');
    expect(loadedOf(1).linkedEvent).toBeNull();
    expect(loadedOf(1).sceneSets).toEqual([]);
    expect(loadProductionChecks).toHaveBeenCalledTimes(2);
  });

  test("a slow answer for the episode she left does not reach the next episode's run, hold it up or start one of its own", async () => {
    const newSets = deferred();
    const newBrief = deferred();
    // She moves to the bare episode while the first one's brief is still out.
    const firstBrief = deferred();
    open(EP_FULL, ADMIN, (key, nth) => {
      if (key === briefOf(EP_FULL) && nth === 1) return firstBrief.promise;
      if (key === setsOf(EP_BARE) && nth === 1) return newSets.promise;
      if (key === briefOf(EP_BARE) && nth === 1) return newBrief.promise;
      return undefined;
    });
    await screen.findByTestId('overview-next-step');
    await act(async () => { go(`/episodes/${EP_BARE}`); });
    await waitFor(() => expect(asked(briefOf(EP_BARE))).toBe(1));
    // The bare episode's scene sets answer, then the old episode's brief, then the bare episode's brief.
    await act(async () => { newSets.resolve({ data: { data: [] } }); });
    await act(async () => { firstBrief.resolve({ data: { data: { id: 'brief-1', episode_id: EP_FULL } } }); });
    expect(loadProductionChecks).not.toHaveBeenCalled();
    await act(async () => { newBrief.resolve({ data: { data: { id: 'brief-2', episode_id: EP_BARE } } }); });
    await loaderRan(1);
    expect(loadProductionChecks.mock.calls[0][0].id).toBe(EP_BARE);
    expect(loadedOf(0).brief.id).toBe('brief-2');
    expect(loadedOf(0).sceneSets).toEqual([]);
    expect(loadProductionChecks).toHaveBeenCalledTimes(1);
  });
});
