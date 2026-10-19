/**
 * The page shows the episode in the URL (Script page re-audit, 2026-10-19):
 * a load that answers after the page has moved on is dropped, so Back
 * during a load no longer leaves episode B under episode A's URL.
 */
import { vi, test, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

vi.mock('../components/Episodes/EpisodeRawFootageTab', () => ({
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
import episodeService from '../services/episodeService';
import EpisodeDetail from './EpisodeDetail';

let nav;
const Where = () => { nav = useNavigate(); return <span data-testid="where">{useLocation().pathname}</span>; };

test('Back during a load: the earlier episode\'s late answer is dropped', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: {} });
  let answerB;
  vi.mocked(episodeService.getEpisode).mockImplementation((id) => {
    if (id === 'ep-b') return new Promise((r) => { answerB = () => r({ id: 'ep-b', title: 'Episode Bee', show_id: 'show-1', show: { id: 'show-1' } }); });
    return Promise.resolve({ id: 'ep-a', title: 'Episode Ay', show_id: 'show-1', show: { id: 'show-1' } });
  });
  render(
    <MemoryRouter initialEntries={['/episodes/ep-a?tab=overview']}>
      <Routes><Route path="/episodes/:episodeId" element={<><Where /><EpisodeDetail /></>} /></Routes>
    </MemoryRouter>,
  );
  await screen.findAllByText(/Episode Ay/);
  await act(async () => { nav('/episodes/ep-b?tab=overview'); });
  await act(async () => { nav(-1); });
  await screen.findAllByText(/Episode Ay/);
  await act(async () => { answerB(); });
  expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-a');
  expect(screen.queryAllByText(/Episode Bee/)).toHaveLength(0);
  expect(screen.getAllByText(/Episode Ay/).length).toBeGreaterThan(0);
});
