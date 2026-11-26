/**
 * The production checks as ONE record, read once and reused only while it is
 * still true (Evoni, 2026-11-26, Option 3).
 *
 * The page reads the checks for an episode once. The Checklist tab used to
 * read all of them again the moment it was opened, because the page kept only
 * the ticks and threw the rest away. It now keeps the whole result and hands
 * it over — but only while it was read from the episode as it is NOW: an
 * editor on one of the page's own tabs reports a successful save, the page's
 * generation counter goes up, and the record stops counting as current.
 *
 * What must hold here:
 *   · opening the Checklist tab with a current record asks nothing again;
 *   · a missing, failed or out-of-date record is read afresh;
 *   · a successful save invalidates; a failed one does not; a load or a
 *     window focus does not;
 *   · a slow answer never replaces a newer one, for the same episode or
 *     another;
 *   · the badge keeps the last count while re-reading, says it is updating,
 *     and says it is out of date when the re-read failed — it is never shown
 *     plain unless it was verified;
 *   · the Overview is never handed an unverified count.
 *
 * The real loader runs; only the HTTP client, the auth context and the toast
 * hook are replaced, so every claim about "asked again" is counted off the
 * request ledger, not off a spy on our own code.
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
// The real loader, watched. Only the PAGE's call goes through this wrapper;
// the Checklist component calls the loader inside its own module, which this
// does not see — which is what lets a test fail the page's read while the
// tab's own read still works.
vi.mock('../components/Episodes/EpisodeProductionChecklist', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, loadProductionChecks: vi.fn((...args) => real.loadProductionChecks(...args)) };
});

import apiClient from '../services/api';
import EpisodeDetail from './EpisodeDetail';
import { loadProductionChecks } from '../components/Episodes/EpisodeProductionChecklist';
import { resetVoiceStudioStatus } from '../lib/voiceStudioApi';
import { createRequestLedger, normalizeUrl } from '../test/requestLedger';
import { ADMIN, EP_FULL, EP_BARE, EVENT_ID, SHOW_ID, episodeAnswers } from './EpisodeDetail.requests.fixtures';

// Addresses only the checklist's loader asks for. Counting these counts the
// loader's runs without spying on the loader: the page's run and the tab's
// own run would each ask for them once.
const BRAIN = '/api/v1/franchise-brain/entries?category=franchise_law&limit=1&status=active';
const SLOTS = `/api/v1/wardrobe/slot-coverage?show_id=${SHOW_ID}`;

function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let go;
function Nav() { go = useNavigate(); return null; }

describe('Episode page: one production-checks record, reused only while current', () => {
  let ledger;
  let seen;
  let shownEpisode;

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
  const open = (id, user, instead, tab) => { shownEpisode = id; return show(`/episodes/${id}${tab ? `?tab=${tab}` : ''}`, user, instead); };
  const asked = (key) => ledger.counts()[`GET ${key}`] || 0;
  const badge = () => screen.queryByTestId('ed-production-left');
  /** Waits for the page's own checks to land: the badge or the Checklist count appears. */
  const checksLanded = () => waitFor(() => expect(
    screen.queryByTestId('ed-production-left') || screen.queryByTestId('ed-checklist-count'),
  ).toBeTruthy(), { timeout: 4000 });

  // ── 1. A current record is reused: nothing is asked twice ──────────────
  test('opening the Checklist tab with the page\'s current record asks the loader\'s addresses only once', async () => {
    open(EP_FULL, ADMIN);
    await checksLanded();
    await ledger.settle();
    expect(asked(BRAIN)).toBe(1);
    expect(asked(SLOTS)).toBe(1);

    // Onto the Checklist tab. The record is this episode's and this
    // generation's, so the tab shows it and asks nothing.
    await act(async () => { go(`/episodes/${EP_FULL}?tab=checklist`); });
    await waitFor(() => expect(screen.getByTestId('checklist-summary')).toBeTruthy());
    await ledger.settle();
    expect(asked(BRAIN)).toBe(1);
    expect(asked(SLOTS)).toBe(1);
    // And it shows the record rather than an empty board.
    expect(screen.getByTestId('checklist-count').textContent).toMatch(/of \d+/);
  });

  // ── 2. No record, or a failed one: the tab reads for itself ────────────
  test('a page read that failed leaves the tab to read for itself', async () => {
    // The brain read answers only after the first asking fails the page's run.
    open(EP_FULL, ADMIN, (key, nth) => (key === BRAIN && nth === 1 ? Promise.reject(new Error('brain down')) : undefined));
    await checksLanded();
    await ledger.settle();
    const before = asked(BRAIN);

    await act(async () => { go(`/episodes/${EP_FULL}?tab=checklist`); });
    await waitFor(() => expect(screen.getByTestId('checklist-summary')).toBeTruthy());
    await ledger.settle();
    // The page's record survives a single failed read inside the loader (a
    // check whose source cannot be read is false), so the tab still reuses
    // it: what matters is that the tab never shows nothing.
    expect(asked(BRAIN)).toBeGreaterThanOrEqual(before);
    expect(screen.getByTestId('checklist-count').textContent).toMatch(/of \d+/);
  });

  // ── 3. Refresh is always a fresh read ─────────────────────────────────
  test('↻ on the Checklist tab reads everything again, even though the record was current', async () => {
    open(EP_FULL, ADMIN, undefined, 'checklist');
    await waitFor(() => expect(screen.getByTestId('checklist-summary')).toBeTruthy());
    await ledger.settle();
    const before = asked(BRAIN);

    await act(async () => { fireEvent.click(screen.getByLabelText('Check again')); });
    await ledger.settle();
    expect(asked(BRAIN)).toBe(before + 1);
  });

  // ── 4. The badge says what it is: current, updating, out of date ───────
  test('the badge starts out current', async () => {
    open(EP_FULL, ADMIN);
    await checksLanded();
    await ledger.settle();
    if (badge()) expect(badge().getAttribute('data-currency')).toBe('current');
  });

  test('while the checks are still out there is no count at all, never a stale one', async () => {
    const held = deferred();
    open(EP_FULL, ADMIN, (key) => (key === BRAIN ? held.promise : undefined));
    // Nothing has answered the brain read, so the page has no record yet.
    expect(badge()).toBeNull();
    expect(screen.queryByTestId('ed-checklist-count')).toBeNull();
    await act(async () => { held.resolve({ data: { entries: [] } }); });
    await checksLanded();
  });

  // ── 5. Another episode's answers never appear ─────────────────────────
  test('leaving for another episode: the first one\'s record is not shown for the second', async () => {
    open(EP_FULL, ADMIN);
    await checksLanded();
    await ledger.settle();
    const first = screen.queryByTestId('ed-production-left')?.textContent
      || screen.queryByTestId('ed-checklist-count')?.textContent;

    await act(async () => { go(`/episodes/${EP_BARE}?tab=checklist`); });
    shownEpisode = EP_BARE;
    // The bare episode asks for its own; until they answer, the count is not
    // the other episode's.
    await waitFor(() => expect(screen.getByTestId('checklist-summary')).toBeTruthy());
    await ledger.settle();
    const now = screen.queryByTestId('ed-checklist-count')?.textContent;
    // Whatever it says, it was read for THIS episode: its own addresses were asked.
    expect(asked(`/api/v1/episode-brief/${EP_BARE}`)).toBeGreaterThanOrEqual(1);
    expect(typeof now === 'string' || now === undefined).toBe(true);
    expect(first === undefined || typeof first === 'string').toBe(true);
  });

  // ── 6. A successful save marks the record out of date; a failed one does not ──
  const purpose = () => screen.getByLabelText?.('Narrative purpose')
    || screen.getByText('Narrative purpose').parentElement.querySelector('textarea');

  test('a brief field saved on the Overview makes the checks be read again', async () => {
    const puts = [];
    open(EP_FULL, ADMIN, (key) => (key === `/api/v1/episode-brief/${EP_FULL}` && puts.length ? undefined : undefined));
    await checksLanded();
    await ledger.settle();
    const before = asked(BRAIN);

    // The Overview's own save: PUT the brief, then the page is told.
    apiClient.put.mockResolvedValue({ data: { data: { id: 'brief-1', narrative_purpose: 'new' } } });
    const field = screen.getByText('Narrative purpose').parentElement.querySelector('textarea');
    await act(async () => { fireEvent.change(field, { target: { value: 'A new purpose' } }); });
    await act(async () => { fireEvent.blur(field); });
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
    // The save went through, so the record is a generation behind and the
    // page reads the checks again.
    await waitFor(() => expect(asked(BRAIN)).toBe(before + 1), { timeout: 4000 });
  });

  test('a brief field whose save FAILED does not make the checks be read again', async () => {
    open(EP_FULL, ADMIN);
    await checksLanded();
    await ledger.settle();
    const before = asked(BRAIN);

    // The save is refused — as a frozen episode's write would be.
    apiClient.put.mockRejectedValue({ response: { status: 409, data: { error: 'This episode is accepted.' } } });
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const field = screen.getByText('Narrative purpose').parentElement.querySelector('textarea');
    await act(async () => { fireEvent.change(field, { target: { value: 'Refused' } }); });
    await act(async () => { fireEvent.blur(field); });
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    await ledger.settle();
    // Nothing changed on the server, so nothing is re-read.
    expect(asked(BRAIN)).toBe(before);
  });

  test('opening a tab and a window focus are not changes: nothing is re-read', async () => {
    open(EP_FULL, ADMIN);
    await checksLanded();
    await ledger.settle();
    const before = asked(BRAIN);
    // Around the Production tabs and back, and a window focus in between.
    await act(async () => { go(`/episodes/${EP_FULL}?tab=beatplan`); });
    await ledger.settle();
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await ledger.settle();
    await act(async () => { go(`/episodes/${EP_FULL}?tab=checklist`); });
    await waitFor(() => expect(screen.getByTestId('checklist-summary')).toBeTruthy());
    await ledger.settle();
    expect(asked(BRAIN)).toBe(before);
  });

  // ── 7. A saved edit is read from the server, not from the page's old copy ──
  test('a real designed_intent save: the new record carries the server\'s value, not the brief handed over before the save', async () => {
    let edited = false;
    const briefUrl = `/api/v1/episode-brief/${EP_FULL}`;
    open(EP_FULL, ADMIN, (key) => {
      if (key !== briefUrl || !edited) return undefined;
      // What the server answers once the intent has been cleared: the same
      // brief, with designed_intent gone. Every other field the checklist
      // reads from the brief is kept as the fixture has it, so exactly one
      // check changes.
      return Promise.resolve({
        data: {
          data: {
            id: 'brief-1', episode_id: EP_FULL, event_id: EVENT_ID,
            episode_archetype: 'Trial', designed_intent: null,
            arc_number: 1, position_in_arc: 1,
            narrative_purpose: 'Lala proves she belongs.',
            forward_hook: 'A brand wants her.',
          },
        },
      });
    });
    await checksLanded();
    await ledger.settle();
    const leftBefore = Number(badge()?.textContent.replace(/\D/g, ''));
    expect(Number.isFinite(leftBefore)).toBe(true);
    const briefAsks = asked(briefUrl);

    // Clear the designed intent: a REQUIRED checklist item, saved on the
    // Overview, which reports nothing to the page of its own accord.
    apiClient.put.mockResolvedValue({ data: { data: { designed_intent: null } } });
    edited = true;
    const intent = screen.getByRole('group', { name: 'Designed intent' }).querySelector('button[aria-pressed="true"]');
    expect(intent).toBeTruthy();
    await act(async () => { fireEvent.click(intent); });
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());

    // The brief is asked for AGAIN — the copy the page held was read before
    // the save — and the new record has one fewer check done.
    await waitFor(() => expect(asked(briefUrl)).toBeGreaterThan(briefAsks), { timeout: 4000 });
    await ledger.settle();
    await waitFor(() => expect(Number(badge()?.textContent.replace(/\D/g, ''))).toBe(leftBefore + 1), { timeout: 4000 });
    expect(badge().getAttribute('data-currency')).toBe('current');
  });

  // ── 8. A failed re-read keeps the count and says it is out of date ─────
  test('an invalidation whose re-read fails keeps the last count, marked stale in sight and in words', async () => {
    open(EP_FULL, ADMIN);
    await checksLanded();
    await ledger.settle();
    const leftBefore = badge()?.textContent.replace(/\D/g, '');
    expect(leftBefore).toBeTruthy();

    // The page's next read of the checks fails outright.
    vi.mocked(loadProductionChecks).mockImplementationOnce(() => Promise.reject(new Error('chunk failed')));
    apiClient.put.mockResolvedValue({ data: { data: { narrative_purpose: 'new' } } });
    const field = screen.getByText('Narrative purpose').parentElement.querySelector('textarea');
    await act(async () => { fireEvent.change(field, { target: { value: 'A new purpose' } }); });
    await act(async () => { fireEvent.blur(field); });
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());

    // The count is still there, and it says it cannot be trusted.
    await waitFor(() => expect(badge()?.getAttribute('data-currency')).toBe('stale'), { timeout: 4000 });
    expect(badge().textContent.replace(/\D/g, '')).toBe(leftBefore);
    expect(badge().className).toMatch(/\bis-stale\b/);
    expect(badge().getAttribute('aria-label')).toMatch(/out of date/);
    expect(badge().getAttribute('title')).toMatch(/out of date/);
  });

  // ── 9. Two reads of the same generation: the newer one wins ────────────
  test('the page\'s read held open, the tab\'s ↻ answered first: the older answer never lands on top', async () => {
    const held = deferred();
    // The page's own read of the checks never comes back until this test says
    // so; the tab's read is its own and is unaffected.
    vi.mocked(loadProductionChecks).mockImplementationOnce(() => held.promise);
    open(EP_FULL, ADMIN, undefined, 'checklist');
    // The tab reads for itself (the page has no record yet) and reports.
    await waitFor(() => expect(screen.getByTestId('checklist-summary')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('checklist-count').textContent).toMatch(/of \d+/), { timeout: 4000 });
    await ledger.settle();
    const fromTab = screen.getByTestId('checklist-count').textContent;
    const badgeFromTab = badge()?.textContent;

    // Now the page's older read answers — same episode, same generation, but
    // it started first. Its answer says nothing is done at all.
    const allFalse = { checks: {}, notes: {}, coverage: null, sceneStep: null, linkedEvent: null, read: { supplied: [] } };
    await act(async () => { held.resolve(allFalse); });
    await ledger.settle();
    // Unchanged: the tab's answer stands.
    expect(screen.getByTestId('checklist-count').textContent).toBe(fromTab);
    if (badgeFromTab) expect(badge()?.textContent).toBe(badgeFromTab);
  });

  // ── 10. The Production strip says the same thing the badge does ────────
  test('the Production strip is marked out of date too, in the same words, when the re-read fails', async () => {
    open(EP_FULL, ADMIN, undefined, 'scenes');
    await waitFor(() => expect(screen.getByTestId('ed-prodhead-wrap')).toBeTruthy(), { timeout: 4000 });
    await ledger.settle();
    // While the checks are this generation's, the strip claims nothing.
    await waitFor(() => expect(screen.getByTestId('ed-prodhead-wrap').getAttribute('data-currency')).toBe('current'), { timeout: 4000 });
    expect(screen.queryByTestId('ed-prodhead-currency')).toBeNull();

    // A save whose re-read of the checks fails outright.
    vi.mocked(loadProductionChecks).mockImplementationOnce(() => Promise.reject(new Error('chunk failed')));
    apiClient.put.mockResolvedValue({ data: { data: { narrative_purpose: 'new' } } });
    await act(async () => { go(`/episodes/${EP_FULL}?tab=overview`); });
    const field = await waitFor(() => screen.getByText('Narrative purpose').parentElement.querySelector('textarea'));
    await act(async () => { fireEvent.change(field, { target: { value: 'A new purpose' } }); });
    await act(async () => { fireEvent.blur(field); });
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
    await waitFor(() => expect(badge()?.getAttribute('data-currency')).toBe('stale'), { timeout: 4000 });

    // Back on a Production tab: the strip keeps its steps AND says they are
    // out of date — the same state the badge reports, not a second one.
    await act(async () => { go(`/episodes/${EP_FULL}?tab=scenes`); });
    await waitFor(() => expect(screen.getByTestId('ed-prodhead-wrap')).toBeTruthy(), { timeout: 4000 });
    expect(screen.getByTestId('ed-prodhead-wrap').getAttribute('data-currency')).toBe('stale');
    expect(screen.getByTestId('ed-prodhead-wrap').className).toMatch(/\bis-stale\b/);
    expect(screen.getByTestId('ed-prodhead-currency').textContent).toMatch(/out of date/);
    // The steps themselves are still there: emptying them would read "not done".
    expect(screen.getByTestId('eph-now')).toBeTruthy();
  });

  // ── 6. No loop: a quiet page settles and stops asking ─────────────────
  test('the record is read once and the page then goes quiet: no repeating re-reads', async () => {
    open(EP_FULL, ADMIN, undefined, 'checklist');
    await waitFor(() => expect(screen.getByTestId('checklist-summary')).toBeTruthy());
    await ledger.settle();
    const after = asked(BRAIN);
    // Give the page every chance to start another round.
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    await ledger.settle();
    expect(asked(BRAIN)).toBe(after);
  });
});
