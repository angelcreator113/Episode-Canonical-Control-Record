/**
 * The Episode page's request baseline (PR-01 of
 * docs/design/2026-11-studio-home-episode-command-center.md, §7): a default
 * open of /episodes/:id, which is the Overview tab.
 *
 * These are EXACT pins of what the page asks for today, measured on main at
 * 2e56a54d. They are the measuring instrument, not a target:
 *   - a change that lowers a number updates the pin in the same pull
 *     request and says what it removed;
 *   - a change that raises one needs Evoni's approval.
 * No performance ceiling is asserted here.
 *
 * Lowered by PR-08 (measured on main at f5b44e0e): the production
 * checklist's loader is handed three things the page already holds, so it
 * no longer asks for them. Per default open, three requests fewer and no
 * address added or dropped:
 *   GET /episodes/:id/events      3 -> 2  (was: the page, the Overview, the checklist)
 *   GET /episode-brief/:id        2 -> 1  (was: the Overview, the checklist)
 *   GET /episodes/:id/scene-sets  2 -> 1  (was: the Overview, the checklist)
 * BARE 28 -> 25 and FULL 34 -> 31; the addresses stay 22 and 26; the
 * repeated addresses go from five to three and from seven to five.
 *
 * The real EpisodeDetail, EpisodeOverviewTab and production-checklist loader
 * (loadProductionChecks) are rendered, with every child they mount. Only the
 * HTTP client, the auth context and the toast hook are replaced; none of
 * those three makes a request.
 *
 * Two sample episodes, because some reads are conditional:
 *   - FULL, as an admin: an event with a venue set, a brief that names its
 *     source event, a parent event and the profile it started from;
 *   - BARE, as an editor: no event and a brief with no links.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn(), defaults: {} },
}));
// One stable object each: EpisodeDetail's load effect depends on the toast,
// so a fresh object per render would reload the episode for ever.
const { auth, mockToast } = vi.hoisted(() => ({
  auth: { user: null },
  mockToast: { showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn(), showWarning: vi.fn() },
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user, isAuthenticated: true, loading: false }) }));
vi.mock('../components/ToastContainer', () => ({ useToast: () => mockToast }));

import apiClient from '../services/api';
import EpisodeDetail from './EpisodeDetail';
import { resetVoiceStudioStatus } from '../lib/voiceStudioApi';
import { createRequestLedger } from '../test/requestLedger';
import {
  ADMIN, EDITOR, EP_FULL, EP_BARE, EVENT_ID, SET_ID, PROFILE_ID, SHOW_ID, episodeAnswers,
} from './EpisodeDetail.requests.fixtures';

// ── Today's exact baseline ────────────────────────────────────────────────
/** What every default open asks for, and how many times: 25 requests, 22 addresses. */
const always = (id) => ({
  [`GET /api/v1/assets?asset_type=SOCIAL_CHECKLIST&episode_id=${id}&limit=1`]: 1,
  [`GET /api/v1/characters/lala/state?show_id=${SHOW_ID}`]: 1,
  [`GET /api/v1/episode-brief/${id}`]: 1, // the Overview (the checklist is handed it, PR-08)
  [`GET /api/v1/episode-brief/${id}/plan`]: 1,
  [`GET /api/v1/episodes/${id}`]: 2, // the page, the checklist
  [`GET /api/v1/episodes/${id}/events`]: 2, // the page, the Overview (the checklist is handed the page's, PR-08)
  [`GET /api/v1/episodes/${id}/lookbook`]: 2, // the style board, the checklist
  [`GET /api/v1/episodes/${id}/overlays`]: 1,
  [`GET /api/v1/episodes/${id}/scene-sets`]: 1, // the Overview (the checklist is handed them, PR-08)
  [`GET /api/v1/episodes/${id}/scripts?includeAllVersions=false`]: 1,
  [`GET /api/v1/episodes/${id}/style-sheet`]: 1,
  [`GET /api/v1/episodes/${id}/timeline/placements`]: 1,
  [`GET /api/v1/episodes/${id}/todo/social`]: 1,
  [`GET /api/v1/episodes?limit=100&page=1&show_id=${SHOW_ID}&sort=episode_number:ASC`]: 1,
  ['GET /api/v1/franchise-brain/entries?category=franchise_law&limit=1&status=active']: 1,
  [`GET /api/v1/ui-overlays/${SHOW_ID}`]: 1,
  [`GET /api/v1/wardrobe/outfit/${id}`]: 1,
  [`GET /api/v1/wardrobe/slot-coverage?show_id=${SHOW_ID}`]: 1,
  [`GET /api/v1/world/${SHOW_ID}/balance`]: 1,
  [`GET /api/v1/world/${SHOW_ID}/episodes/${id}/money`]: 1,
  [`GET /api/v1/world/${SHOW_ID}/events`]: 1,
  [`GET /api/v1/world/${SHOW_ID}/financial-ledger?episode_id=${id}&limit=50`]: 1,
});

// BARE, as an editor.
const BARE = {
  counts: always(EP_BARE),
  initial: [`GET /api/v1/episodes/${EP_BARE}`, `GET /api/v1/episodes/${EP_BARE}/events`],
  afterInitial: 23,
  total: 25,
  distinct: 22,
};

// FULL, as an admin: six more requests, four more addresses.
const FULL = {
  counts: {
    ...always(EP_FULL),
    ['GET /api/v1/voice-studio/status']: 1, // an admin
    [`GET /api/v1/world/${SHOW_ID}/events/${EVENT_ID}`]: 1, // the brief's source event
    [`GET /api/v1/wardrobe/outfit/${EP_FULL}`]: 2, // again, for the brief's source event
    [`GET /api/v1/world/${SHOW_ID}/events`]: 2, // again, to name the parent event
    [`GET /api/v1/social-profiles/${PROFILE_ID}`]: 1, // the profile it started from
    [`GET /api/v1/scene-sets/${SET_ID}`]: 1, // the event's venue set
  },
  initial: ['GET /api/v1/voice-studio/status', `GET /api/v1/episodes/${EP_FULL}`, `GET /api/v1/episodes/${EP_FULL}/events`],
  afterInitial: 28,
  total: 31,
  distinct: 26,
};

const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const repeated = (counts) => sorted(Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 1)));

describe('Episode page, default open: the requests it makes today (exact baseline)', () => {
  let ledger;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    // Voice Studio's status is asked once per page load and remembered.
    resetVoiceStudioStatus();
    // "Initial" is what is asked while the page still says it is loading the episode.
    ledger = createRequestLedger({ initialWhile: () => !document.body.textContent || /Loading episode/i.test(document.body.textContent) });
    ledger.watchFetch();
  });

  afterEach(() => { ledger.restore(); });

  /** Opens the episode, waits for the page's known states, then for it to settle. */
  async function open(episodeId, user) {
    auth.user = user;
    const { answer, unanswered } = episodeAnswers(episodeId);
    ledger.attach(apiClient, (url) => answer(url));
    render(
      <MemoryRouter initialEntries={[`/episodes/${episodeId}`]}>
        <Routes><Route path="/episodes/:episodeId" element={<EpisodeDetail />} /></Routes>
      </MemoryRouter>,
    );
    // Known state 1: the episode is on screen (the loading state is gone).
    await waitFor(() => expect(screen.queryByText(/Loading episode/i)).toBeNull());
    // Known state 2: the Overview tab has its next step.
    expect(await screen.findByTestId('overview-next-step')).toBeTruthy();
    // Known state 3: the production checklist has been read through.
    expect(await screen.findByText(/Production checklist: \d+ of \d+ done/)).toBeTruthy();
    await ledger.settle();
    return unanswered;
  }

  function expectBaseline(pin, unanswered) {
    // Every address the page asked for has an answer in the fixtures.
    expect(unanswered).toEqual([]);
    expect(sorted(ledger.counts())).toEqual(sorted(pin.counts));
    expect(ledger.duplicates()).toEqual(repeated(pin.counts));
    expect(ledger.lines('initial')).toEqual(pin.initial);
    expect(ledger.total('settled')).toBe(pin.afterInitial);
    expect(ledger.total()).toBe(pin.total);
    expect(Object.keys(ledger.counts()).length).toBe(pin.distinct);
    // Reads only, and all through the one client.
    expect(ledger.list().every((e) => e.method === 'GET')).toBe(true);
    expect(ledger.viaFetch()).toEqual([]);
  }

  test('a bare episode, as an editor: 25 requests to 22 addresses, three of them repeated', async () => {
    const unanswered = await open(EP_BARE, EDITOR);
    expectBaseline(BARE, unanswered);
    expect(Object.keys(ledger.duplicates()).length).toBe(3);
  });

  test('a fully linked episode, as an admin: 31 requests to 26 addresses, five of them repeated', async () => {
    const unanswered = await open(EP_FULL, ADMIN);
    expectBaseline(FULL, unanswered);
    expect(Object.keys(ledger.duplicates()).length).toBe(5);
  });
});
