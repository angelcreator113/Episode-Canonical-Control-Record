import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    // Loaded without its show (no association in the answer).
    getEpisode: vi.fn().mockResolvedValue({ id: 'ep-1', title: 'Episode One', show_id: 'show-1' }),
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

vi.mock('../components/Episodes/EpisodeSceneWorkspace', () => ({
  default: () => <div data-testid="episode-scenes">Scene workspace body</div>,
}));

vi.mock('../components/Episodes/EpisodeRawFootageTab', () => ({
  default: () => <div data-testid="episode-assets">Assets body</div>,
}));
vi.mock('../components/Episodes/EpisodeLalasPhoneTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeScriptTab', () => ({
  default: ({ episode, show, onSaved, onDirtyChange }) => (
    <div data-testid="episode-script" data-show={show === undefined ? 'none' : JSON.stringify(show)} data-show-id={episode?.show_id}>
      <span data-testid="script-text">{episode?.script_content || ''}</span>
      <button type="button" data-testid="script-edit" onClick={() => onDirtyChange?.(true)}>edit</button>
      <button type="button" data-testid="script-save" onClick={() => { onSaved?.({ script_content: 'Saved script' }); onDirtyChange?.(false); }}>save</button>
    </div>
  ),
}));
vi.mock('../components/Episodes/EpisodeDistributionTab', () => ({ default: () => null }));
vi.mock('../components/EpisodeWardrobeGameplay', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeStyleSheetPanel', () => ({ default: () => null }));
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


/**
 * The Script tab opens for an episode loaded without its show (2026-10-27):
 * EpisodeDetail passed `show={episode.show || show}`, and no `show` exists
 * there, so with no episode.show the tab threw "show is not defined" and the
 * page showed "Something went wrong". The tab reads the show's id from
 * episode.show_id when it has no show.
 */
describe('EpisodeDetail: the Script tab without episode.show', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: {} });
  });

  test('the Script tab renders, given no show, and the episode carries its show_id', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/episodes/ep-1?tab=scripts']}>
        <Routes><Route path="/episodes/:episodeId" element={<EpisodeDetail />} /></Routes>
      </MemoryRouter>,
    );
    const tab = await screen.findByTestId('episode-script');
    expect(tab.getAttribute('data-show')).toBe('none');
    expect(tab.getAttribute('data-show-id')).toBe('show-1');
    expect(errSpy.mock.calls.some((c) => /show is not defined/.test(String(c[0]?.message || c[0])))).toBe(false);
    errSpy.mockRestore();
  });
});
