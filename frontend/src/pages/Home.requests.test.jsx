/**
 * Home's request baseline (PR-01 of
 * docs/design/2026-11-studio-home-episode-command-center.md, §7).
 *
 * These are EXACT pins of what Home asks for today, measured on main at
 * 2e56a54d. They are the measuring instrument, not a target:
 *   - a change that lowers a number updates the pin in the same pull
 *     request and says what it removed;
 *   - a change that raises one needs Evoni's approval.
 * The performance goals (first paint <= 6, fully loaded <= 21) are a
 * separate matter, recorded in the plan; nothing here asserts them.
 *
 * The real Home and the real Sidebar are rendered. Only the HTTP client and
 * the auth context (which makes no request) are replaced.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Evoni', email: 'e@x.dev' }, logout: vi.fn(), isAuthenticated: true, loading: false }),
}));

import apiClient from '../services/api';
import Home from './Home';
import Sidebar from '../components/layout/Sidebar';
import { answerFor } from './Home.fixtures';
import { createRequestLedger } from '../test/requestLedger';

// ── Today's exact baseline ────────────────────────────────────────────────
// Home asks for the show list first, then nine reads together. The episode
// list is the newest 100 across every show (no show_id).
const HOME_REQUESTS = [
  'GET /api/v1/character-registry/registries',
  'GET /api/v1/characters/lala/state?show_id=show-1',
  'GET /api/v1/daily-update',
  'GET /api/v1/episodes?limit=100&page=1',
  'GET /api/v1/feed-posts?limit=50&show_id=show-1&status=live',
  'GET /api/v1/public/looks',
  'GET /api/v1/shows',
  'GET /api/v1/shows/show-1/financial-summary',
  'GET /api/v1/storyteller/books',
  'GET /api/v1/world/show-1/events',
];
const HOME_INITIAL = 10; // asked while the loading state is on screen
const HOME_AFTER_INITIAL = 0; // asked after it clears
const HOME_TOTAL = 10; // asked once the page has settled
// With the app's Sidebar beside it, the show list is read a second time.
const HOME_WITH_SIDEBAR_INITIAL = 11;
const HOME_WITH_SIDEBAR_AFTER_INITIAL = 0;
const HOME_WITH_SIDEBAR_TOTAL = 11;
const HOME_WITH_SIDEBAR_DUPLICATES = { 'GET /api/v1/shows': 2 };

describe('Home: the requests it makes today (exact baseline)', () => {
  let ledger;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    // "Initial" is what is asked while Home still shows its loading state.
    ledger = createRequestLedger({ initialWhile: () => !document.body.textContent || document.body.textContent.includes('Loading your workspace…') });
    const answer = answerFor();
    ledger.attach(apiClient, (url) => answer(url));
    ledger.watchFetch();
  });

  afterEach(() => { ledger.restore(); });

  /** Renders, waits for the loading state to clear, then for the page to settle. */
  async function load(ui) {
    render(<MemoryRouter>{ui}</MemoryRouter>);
    expect(screen.getByText('Loading your workspace…')).toBeTruthy();
    // Known state 1: the workspace is on screen (the loading state is gone).
    await waitFor(() => expect(screen.queryByText('Loading your workspace…')).toBeNull());
    // Known state 2: the cards have their data.
    expect(await screen.findByText('Which bag?')).toBeTruthy();
    expect(screen.getByTestId('home-continue')).toBeTruthy();
    await ledger.settle();
  }

  test('Home alone: ten reads, all before the loading state clears, none repeated', async () => {
    await load(<Home />);

    expect(ledger.lines().slice().sort()).toEqual(HOME_REQUESTS);
    expect(ledger.total('initial')).toBe(HOME_INITIAL);
    expect(ledger.total('settled')).toBe(HOME_AFTER_INITIAL);
    expect(ledger.total()).toBe(HOME_TOTAL);
    expect(ledger.duplicates()).toEqual({});
    // The show list is asked for first, alone; the other nine follow together.
    expect(ledger.lines()[0]).toBe('GET /api/v1/shows');
    // Reads only, and all through the one client.
    expect(ledger.list().every((e) => e.method === 'GET')).toBe(true);
    expect(ledger.viaFetch()).toEqual([]);
  });

  test('Home with the Sidebar: eleven reads, the show list twice', async () => {
    await load(<><Sidebar isOpen onClose={() => {}} /><Home /></>);

    expect(ledger.total('initial')).toBe(HOME_WITH_SIDEBAR_INITIAL);
    expect(ledger.total('settled')).toBe(HOME_WITH_SIDEBAR_AFTER_INITIAL);
    expect(ledger.total()).toBe(HOME_WITH_SIDEBAR_TOTAL);
    expect(ledger.duplicates()).toEqual(HOME_WITH_SIDEBAR_DUPLICATES);
    expect([...new Set(ledger.lines())].sort()).toEqual(HOME_REQUESTS);
    expect(ledger.list().every((e) => e.method === 'GET')).toBe(true);
    expect(ledger.viaFetch()).toEqual([]);
  });
});
