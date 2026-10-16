/**
 * The episode header's previous/next switcher and status dropdown.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
      id: 'ep-2',
      title: 'Episode Two',
      episode_number: 2,
      status: 'draft',
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
import episodeService from '../services/episodeService';
import EpisodeDetail from './EpisodeDetail';

const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };
const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId" element={<><EpisodeDetail /><Where /></>} />
    </Routes>
  </MemoryRouter>,
);

const EPISODES = [
  { id: 'ep-3', episode_number: 3, title: 'Three' },
  { id: 'ep-1', episode_number: 1, title: 'One' },
  { id: 'ep-2', episode_number: 2, title: 'Episode Two' },
];

describe('Episode header: previous/next and status (Episode Style mock, 2026-10-16)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockClear?.());
    vi.mocked(episodeService.updateEpisode).mockReset();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes?show_id=show-1&limit=500&sort=episode_number:ASC') return { data: { data: EPISODES } };
      return { data: {} };
    });
  });

  test('the switcher steps to the episodes either side by number, keeping the tab', async () => {
    renderAt('/episodes/ep-2?tab=checklist');
    const sw = await screen.findByTestId('ed-ep-switch');
    const prev = await within(sw).findByRole('button', { name: 'Previous episode: 1 One' });
    const next = within(sw).getByRole('button', { name: 'Next episode: 3 Three' });
    expect(prev.disabled).toBe(false);
    fireEvent.click(next);
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-3?tab=checklist');
  });

  test('at the end of the show there is no next', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url.startsWith('/api/v1/episodes?show_id=')
      ? { data: { data: EPISODES.filter((e) => e.id !== 'ep-3') } } : { data: {} }));
    renderAt('/episodes/ep-2?tab=checklist');
    const sw = await screen.findByTestId('ed-ep-switch');
    await within(sw).findByRole('button', { name: 'Previous episode: 1 One' });
    expect(within(sw).getByRole('button', { name: 'No next episode' }).disabled).toBe(true);
  });

  test('the status dropdown offers the pipeline statuses and saves the one chosen', async () => {
    vi.mocked(episodeService.updateEpisode).mockResolvedValue({});
    renderAt('/episodes/ep-2?tab=checklist');
    const select = await screen.findByTestId('ed-status');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Draft', 'Scripted', 'In build', 'In review', 'Scheduled', 'Published', 'Archived']);
    expect(select.value).toBe('draft');
    fireEvent.change(select, { target: { value: 'scripted' } });
    await waitFor(() => expect(episodeService.updateEpisode).toHaveBeenCalledWith('ep-2', { status: 'scripted' }));
    expect(screen.getByTestId('ed-status').value).toBe('scripted');
  });

  test('a status that cannot be saved goes back, and says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(episodeService.updateEpisode).mockRejectedValue(new Error('down'));
    renderAt('/episodes/ep-2?tab=checklist');
    const select = await screen.findByTestId('ed-status');
    fireEvent.change(select, { target: { value: 'published' } });
    await waitFor(() => expect(screen.getByTestId('ed-status').value).toBe('draft'));
    expect(mockToast.showError).toHaveBeenCalledWith('The status could not be saved.');
  });
});
