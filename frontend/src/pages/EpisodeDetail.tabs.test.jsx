/**
 * The episode page's tab is its URL (audit LINK-04, 2026-10-03): clicks,
 * Ctrl/Cmd shortcuts, deep links and Back/Forward all go through one
 * parser, so Back from Production → Money to Overview shows Overview (not
 * an empty "overview.money"), Forward brings Money back, a sub-tab click is
 * in the URL, and the page's other parameters survive a tab change. The
 * mocks are EpisodeDetail.test.jsx's.
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

const Probe = () => {
  const l = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="where">{l.pathname}{l.search}</div>
      <button data-testid="back" onClick={() => navigate(-1)}>back</button>
      <button data-testid="forward" onClick={() => navigate(1)}>forward</button>
    </>
  );
};
const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId" element={<><EpisodeDetail /><Probe /></>} />
    </Routes>
  </MemoryRouter>,
);
const where = () => screen.getByTestId('where').textContent;
const activeMain = () => document.querySelector('.ed-tab-active .ed-tab-label')?.textContent;
const moneyBody = () => screen.queryByText('This episode has no source event, and nothing has posted.');

describe('EpisodeDetail: the tab is the URL (LINK-04)', () => {
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

  test('Back from Money to Overview shows Overview; Forward brings Money back', async () => {
    renderAt('/episodes/ep-1?tab=money');
    await waitFor(() => expect(moneyBody()).toBeTruthy());
    fireEvent.click(screen.getByTitle('Overview'));
    expect(where()).toBe('/episodes/ep-1?tab=overview');
    expect(await screen.findByTestId('episode-overview')).toBeTruthy();
    expect(moneyBody()).toBeNull();

    fireEvent.click(screen.getByTestId('back'));
    expect(where()).toBe('/episodes/ep-1?tab=money');
    await waitFor(() => expect(moneyBody()).toBeTruthy());
    expect(activeMain()).toBe('Production');
    expect(screen.queryByTestId('episode-overview')).toBeNull();

    fireEvent.click(screen.getByTestId('forward'));
    expect(await screen.findByTestId('episode-overview')).toBeTruthy();
    expect(moneyBody()).toBeNull();
  });

  test('a sub-tab click is in the URL, and a tab change keeps the other parameters', async () => {
    renderAt('/episodes/ep-1?tab=assets&from=%2Fshows%2Fshow-1%2Fworld');
    expect(await screen.findByTestId('episode-assets')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Checklist' }));
    expect(where()).toBe('/episodes/ep-1?tab=checklist&from=%2Fshows%2Fshow-1%2Fworld');
    expect(await screen.findByTestId('episode-checklist')).toBeTruthy();
  });

  test('Ctrl+2 opens Production → Wardrobe, in the URL; no ?tab= is the checklist; an unknown tab has a body', async () => {
    renderAt('/episodes/ep-1');
    expect(await screen.findByTestId('episode-checklist')).toBeTruthy();
    fireEvent.keyDown(window, { key: '2', ctrlKey: true });
    expect(where()).toBe('/episodes/ep-1?tab=wardrobe');
    await waitFor(() => expect(activeMain()).toBe('Production'));
    expect(screen.queryByTestId('episode-checklist')).toBeNull();

    fireEvent.click(screen.getByTestId('back'));
    expect(await screen.findByTestId('episode-checklist')).toBeTruthy();
  });

  test('?tab=nope lands on the checklist, not on an empty page', async () => {
    renderAt('/episodes/ep-1?tab=nope');
    expect(await screen.findByTestId('episode-checklist')).toBeTruthy();
  });
});
