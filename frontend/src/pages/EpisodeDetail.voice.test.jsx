/**
 * Production → Voice (Evoni, 2026-10-30): Voice Studio is a pill under
 * Production, after Files, instead of a page linked from the Script tab.
 * The pill shows to an admin while Voice Studio is switched on; ?tab=voice
 * shows Voice Studio in the tab, for this episode. The mocks are
 * EpisodeDetail.tabs.test.jsx's.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const { who } = vi.hoisted(() => ({ who: { user: null } }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false, user: who.user }),
}));

// Voice Studio itself has its own tests (VoiceStudio.test.jsx); here, what the tab hands it.
vi.mock('./VoiceStudio', () => ({
  default: ({ episodeId, embedded }) => <div data-testid="voice-studio-body">{`${episodeId} ${embedded ? 'embedded' : 'page'}`}</div>,
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

vi.mock('../components/Episodes/EpisodeSceneWorkspace', () => ({
  default: () => <div data-testid="episode-scenes">Scene workspace body</div>,
}));

vi.mock('../components/Episodes/EpisodeRawFootageTab', () => ({
  default: () => <div data-testid="episode-assets">Assets body</div>,
}));
vi.mock('../components/Episodes/EpisodeLalasPhoneTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeScriptTab', () => ({
  default: ({ episode, onSaved, onDirtyChange }) => (
    <div data-testid="episode-script">
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
import { resetVoiceStudioStatus } from '../lib/voiceStudioApi';
import EpisodeDetail from './EpisodeDetail';

const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };
const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId" element={<><EpisodeDetail /><Where /></>} />
    </Routes>
  </MemoryRouter>,
);
const makePills = () => [...document.querySelectorAll('.ed-subgroup[aria-label="Make"] .ed-subpill')].map((b) => b.textContent);

describe('Production → Voice', () => {
  let on;
  beforeEach(() => {
    resetVoiceStudioStatus();
    on = true;
    who.user = { groups: ['admin'] };
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/voice-studio/status') {
        if (on) return { data: { data: { on: true } } };
        throw Object.assign(new Error('404'), { response: { status: 404 } });
      }
      return { data: {} };
    });
  });

  test('an admin with Voice Studio on: Voice after Files; clicking it shows Voice Studio for this episode, in the tab', async () => {
    renderAt('/episodes/ep-1?tab=files');
    await waitFor(() => expect(makePills()).toEqual(['Scenes', 'Files', 'Voice']));
    fireEvent.click(screen.getByRole('button', { name: 'Voice' }));
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-1?tab=voice');
    expect((await screen.findByTestId('voice-studio-body')).textContent).toBe('ep-1 embedded');
    expect(document.querySelector('.ed-tab-active .ed-tab-label')?.textContent).toBe('Production');
    expect(screen.getByRole('button', { name: 'Voice' }).getAttribute('aria-current')).toBe('page');
  });

  test('Voice Studio switched off: no Voice pill', async () => {
    on = false;
    renderAt('/episodes/ep-1?tab=files');
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/api/v1/voice-studio/status'));
    await waitFor(() => expect(makePills()).toEqual(['Scenes', 'Files']));
  });

  test('not an admin: no Voice pill, and the switch is not asked', async () => {
    who.user = { groups: ['editor'] };
    renderAt('/episodes/ep-1?tab=files');
    await waitFor(() => expect(makePills()).toEqual(['Scenes', 'Files']));
    expect(vi.mocked(api.get)).not.toHaveBeenCalledWith('/api/v1/voice-studio/status');
  });

  test('a link to ?tab=voice&beat=3 opens the tab (Voice Studio reads the beat from the URL)', async () => {
    renderAt('/episodes/ep-1?tab=voice&beat=3');
    expect((await screen.findByTestId('voice-studio-body')).textContent).toBe('ep-1 embedded');
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-1?tab=voice&beat=3');
  });
});
