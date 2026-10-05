/**
 * The Episode page's header and tabs (Evoni's Episode mock, 2026-10-05):
 * lucide icons, the Production tab's "N left" badge from the production
 * checks (and the checklist's re-checks), the Production pills in the
 * mock's order with Assets last, and the balance chip in coins.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

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

// Three checks, one done: the badge says 2 left; the checklist's own
// re-check reports one more done.
vi.mock('../components/Episodes/EpisodeProductionChecklist', () => ({
  CHECKLIST_SECTIONS: [{ items: [{ id: 'a' }, { id: 'b' }] }, { items: [{ id: 'c' }] }],
  loadProductionChecks: vi.fn().mockResolvedValue({ checks: { a: true } }),
  default: ({ onChecks }) => (
    <button type="button" data-testid="recheck" onClick={() => onChecks({ a: true, b: true }, [{ items: [{ id: 'a' }, { id: 'b' }] }, { items: [{ id: 'c' }] }])}>
      re-check
    </button>
  ),
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

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
    </Routes>
  </MemoryRouter>,
);

describe('Episode header and tabs (redesign part 1)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockClear?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/balance') return { data: { success: true, balance: 1900 } };
      return { data: {} };
    });
  });

  test('Production says how many checks are left, and follows the checklist', async () => {
    renderAt('/episodes/ep-1?tab=checklist');
    const badge = await screen.findByTestId('ed-production-left');
    expect(badge.textContent).toBe('2 left');
    expect(badge.closest('button').getAttribute('title')).toBe('Production');
    fireEvent.click(await screen.findByTestId('recheck'));
    await waitFor(() => expect(screen.getByTestId('ed-production-left').textContent).toBe('1 left'));
  });

  test('the pills run Checklist, Scenes, Wardrobe, Phone, Overlays, Money, Assets; the chosen one is marked', async () => {
    renderAt('/episodes/ep-1?tab=checklist');
    const row = await screen.findByTestId('ed-subtabs');
    expect([...row.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Checklist', 'Scenes', 'Wardrobe', 'Phone', 'Overlays', 'Money', 'Assets']);
    const chosen = row.querySelector('[aria-current="page"]');
    expect(chosen.textContent).toBe('Checklist');
    expect(chosen.className).toContain('is-active');
    expect(screen.getByTitle('Production').getAttribute('aria-current')).toBe('page');
  });

  test('the balance chip reads in coins', async () => {
    renderAt('/episodes/ep-1?tab=overview');
    expect((await screen.findByTestId('ed-balance-chip')).textContent).toBe('1,900 coins');
  });
});
