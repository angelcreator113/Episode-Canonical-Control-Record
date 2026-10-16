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
    expect(activeMain()).toBe('Assets');
    expect(screen.queryByTestId('episode-overview')).toBeNull();

    fireEvent.click(screen.getByTestId('forward'));
    expect(await screen.findByTestId('episode-overview')).toBeTruthy();
    expect(moneyBody()).toBeNull();
  });

  test('a sub-tab click is in the URL, and a tab change keeps the other parameters', async () => {
    renderAt('/episodes/ep-1?tab=files&from=%2Fshows%2Fshow-1%2Fworld');
    expect(await screen.findByTestId('episode-assets')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Money' }));
    expect(where()).toBe('/episodes/ep-1?tab=money&from=%2Fshows%2Fshow-1%2Fworld');
    await waitFor(() => expect(moneyBody()).toBeTruthy());
    fireEvent.click(screen.getByTitle('Production'));
    expect(where()).toBe('/episodes/ep-1?tab=production&from=%2Fshows%2Fshow-1%2Fworld');
    expect(await screen.findByTestId('episode-checklist')).toBeTruthy();
  });

  test('Ctrl+2 opens Assets → Wardrobe, in the URL; no ?tab= is the checklist; an unknown tab has a body', async () => {
    renderAt('/episodes/ep-1');
    expect(await screen.findByTestId('episode-checklist')).toBeTruthy();
    fireEvent.keyDown(window, { key: '2', ctrlKey: true });
    expect(where()).toBe('/episodes/ep-1?tab=wardrobe');
    await waitFor(() => expect(activeMain()).toBe('Assets'));
    // The Wardrobe body loads a lazy panel (the style sheet, Task #2814);
    // the checklist stays on screen until it arrives.
    await waitFor(() => expect(screen.queryByTestId('episode-checklist')).toBeNull());

    fireEvent.click(screen.getByTestId('back'));
    expect(await screen.findByTestId('episode-checklist')).toBeTruthy();
  });

  test('?tab=nope lands on the checklist, not on an empty page', async () => {
    renderAt('/episodes/ep-1?tab=nope');
    expect(await screen.findByTestId('episode-checklist')).toBeTruthy();
  });
});

// The Script tab's saved work and unsaved edits (Script tab audit, 2026-10-15):
// Ctrl/Cmd+S on the Script tab is the tab's own Save, not "go to Scenes";
// leaving the tab with unsaved edits asks first; and a save reaches the
// episode the page holds, so coming back to the tab shows the saved script.
describe('EpisodeDetail: the Script tab keeps its work', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: {} });
  });

  test('Ctrl+S on the Script tab stays on the Script tab', async () => {
    renderAt('/episodes/ep-1?tab=scripts');
    expect(await screen.findByTestId('episode-script')).toBeTruthy();
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(where()).toBe('/episodes/ep-1?tab=scripts');
  });

  test('another tab asks first while the script has unsaved edits', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      renderAt('/episodes/ep-1?tab=scripts');
      fireEvent.click(await screen.findByTestId('script-edit'));
      fireEvent.click(screen.getByTitle('Overview'));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(where()).toBe('/episodes/ep-1?tab=scripts');

      confirm.mockReturnValue(true);
      fireEvent.click(screen.getByTitle('Overview'));
      expect(where()).toBe('/episodes/ep-1?tab=overview');
    } finally { confirm.mockRestore(); }
  });

  test('no question when nothing is unsaved, and a saved script is what the tab shows on return', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    try {
      renderAt('/episodes/ep-1?tab=scripts');
      fireEvent.click(await screen.findByTestId('script-edit'));
      fireEvent.click(screen.getByTestId('script-save'));
      fireEvent.click(screen.getByTitle('Overview'));
      expect(confirm).not.toHaveBeenCalled();
      expect(await screen.findByTestId('episode-overview')).toBeTruthy();

      fireEvent.keyDown(window, { key: '3', ctrlKey: true });
      expect((await screen.findByTestId('script-text')).textContent).toBe('Saved script');
    } finally { confirm.mockRestore(); }
  });

  test('"Back to Show" asks first while the script has unsaved edits', async () => {
    // Re-audit 2 (2026-10-15): a button that leaves the page asks as a tab does.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      renderAt('/episodes/ep-1?tab=scripts');
      fireEvent.click(await screen.findByTestId('script-edit'));
      fireEvent.click(document.querySelector('.ed-back-btn'));
      expect(confirm).toHaveBeenCalledWith('The script has unsaved changes. Leave without saving?');
      expect(where()).toBe('/episodes/ep-1?tab=scripts');
    } finally { confirm.mockRestore(); }
  });
});

