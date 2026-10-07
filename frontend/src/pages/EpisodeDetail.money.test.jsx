/**
 * EpisodeDetail — the Money sub-tab and the header balance chip (Episode
 * Money, Phase A; §8(aa) M1; Task #2278). The mocks below are
 * EpisodeDetail.test.jsx's.
 *
 * Original header of the copied setup:
 * EpisodeDetail — Track 6 CP14 behavioral tests.
 *
 * 10 fetch sites total. 10 migrated via 6 module-scope helpers
 * (high helper-reuse: 4× on listEpisodeLibraryScenesApi, 2× on
 * reorderEpisodeLibrarySceneApi). 0 Pattern G locked (admin-page
 * heuristic v2.20 §9.11 confirmed for third consecutive admin-page
 * CP).
 *
 * UNCLEAR-B resolved as (A) PARTIAL-MIGRATION EXTENSION per v2.20:
 * file has pre-existing `api.post` calls at lines 776, 805
 * (untouched by CP14). CP14 extends migration to the 10 BUG-class
 * raw fetch sites only.
 *
 * Cross-CP duplications per v2.12 §9.11:
 *   - listWorldEventsApi: CP13 WorldAdmin + CP14 = 2-fold cross-CP
 *
 * File-local convention: `api.` import style preserved. Tests use
 * the same default-export mock.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));

// The toast object must be referentially stable across renders. EpisodeDetail's
// `fetchEpisode` useCallback lists `toast` in its deps, and the episode-loading
// effect lists `fetchEpisode` in turn — so a mock that returns a fresh object per
// call makes that effect re-fire on every render and re-enter `setLoading(true)`
// forever, leaving the component stuck on "Loading episode...". `vi.hoisted` is
// what lets the (hoisted) `vi.mock` factory close over this one instance.
const { mockToast } = vi.hoisted(() => ({
  mockToast: { showError: vi.fn(), showSuccess: vi.fn() },
}));

vi.mock('../components/ToastContainer', () => ({
  useToast: () => mockToast,
}));

vi.mock('../services/episodeService', () => ({
  default: {
    getEpisode: vi.fn().mockResolvedValue({
      id: 'ep-1',
      title: 'Episode One',
      show_id: 'show-1',
      show: { id: 'show-1' },
    }),
    updateEpisode: vi.fn(),
  },
}));

vi.mock('../hooks/usePhonePlayback', () => ({
  default: () => ({}),
}));

vi.mock('../components/Episodes/EpisodeOverviewTab', () => ({
  default: () => <div data-testid="episode-overview">Overview body</div>,
}));

vi.mock('../components/Episodes/NextEventSuggestionsOverlay', () => ({
  default: () => null,
}));

vi.mock('../components/SceneLibraryPicker', () => ({
  default: () => null,
}));

vi.mock('../components/Episodes/EpisodeProductionChecklist', () => ({
  default: () => <div data-testid="episode-checklist">Production checklist body</div>,
}));

vi.mock('../components/Episodes/EpisodeTodoList', () => ({
  default: () => <div data-testid="episode-todo-overlays">Episode to-do overlays</div>,
}));

vi.mock('../components/Episodes/EpisodeAssetsTab', () => ({
  default: () => <div data-testid="episode-assets">Assets body</div>,
}));
vi.mock('../components/Episodes/EpisodeLalasPhoneTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeScriptTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeDistributionTab', () => ({ default: () => null }));
vi.mock('../components/EpisodeWardrobeGameplay', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeScenesTab', () => ({ default: () => null }));
vi.mock('../components/PhonePreviewMode', () => ({ default: () => null }));

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import api from '../services/api';
import EpisodeDetail from './EpisodeDetail';

const renderEpisodeDetail = (entry = '/episodes/ep-1') => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
    </Routes>
  </MemoryRouter>,
);

describe('EpisodeDetail — Money tab and balance chip (#2278)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/balance') return { data: { success: true, balance: 1900 } };
      if (url === '/api/v1/world/show-1/episodes/ep-1/money') {
        return { data: { data: { balance: 1900, rows: [], net: 0, event: null, expected: [] } } };
      }
      return { data: {} };
    });
  });

  // Evoni's Episode mock (2026-10-05) orders the pills Checklist, Scenes,
  // Wardrobe, Phone, Overlays, Money, with Assets last.
  test('Production lists Money after Overlays and before Assets', async () => {
    renderEpisodeDetail('/episodes/ep-1?tab=assets');
    await waitFor(() => expect(screen.getByTestId('episode-assets')).toBeTruthy());

    const labels = ['Overlays', 'Money', 'Assets'].map((name) => screen.getByRole('button', { name }));
    const order = (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(order(labels[0], labels[1])).toBeTruthy();
    expect(order(labels[1], labels[2])).toBeTruthy();
  });

  test('the header chip shows the balance from the same /balance the Dashboard reads', async () => {
    renderEpisodeDetail('/episodes/ep-1?tab=overview');

    const chip = await screen.findByTestId('ed-balance-chip');
    expect(chip.textContent).toBe('1,900 coins');
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/balance');
  });

  // Evoni, 2026-10-07: a balance that could not be read used to make the chip vanish.
  test('a balance that cannot be read says so on the chip', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/balance') throw new Error('down');
      return { data: {} };
    });
    renderEpisodeDetail('/episodes/ep-1?tab=overview');
    expect((await screen.findByTestId('ed-balance-chip')).textContent).toBe('Coins unavailable');
  });

  test('the chip opens Production → Money', async () => {
    renderEpisodeDetail('/episodes/ep-1?tab=overview');
    fireEvent.click(await screen.findByTestId('ed-balance-chip'));

    expect(await screen.findByText('This episode has no source event, and nothing has posted.')).toBeTruthy();
    expect(screen.getByTitle('Production').className).toContain('ed-tab-active');
  });

  test('?tab=money lands on the Money tab', async () => {
    renderEpisodeDetail('/episodes/ep-1?tab=money');

    expect(await screen.findByText('This episode has no source event, and nothing has posted.')).toBeTruthy();
  });
});
