/**
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

import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
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

vi.mock('../components/Episodes/EpisodeSceneWorkspace', () => ({
  default: () => <div data-testid="episode-scenes">Scene workspace body</div>,
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
import {
  listEpisodeLibraryScenesApi,
  listWorldEventsApi,
  getCharacterStateApi,
  addEpisodeLibrarySceneApi,
  reorderEpisodeLibrarySceneApi,
  removeEpisodeLibrarySceneApi,
} from './EpisodeDetail';
import EpisodeDetail from './EpisodeDetail';
import episodeService from '../services/episodeService';
import { productionEpisode, resumeEpisode, rememberedEpisodeId, episodeLocation, rememberEpisode, rememberEpisodeLocation } from '../utils/activeEpisode';
import { activeShowId } from '../utils/activeShow';
import { readReturn } from '../utils/returnPath';
import { EP_TABS } from '../utils/episodeTabs';

const renderEpisodeDetail = (entry = '/episodes/ep-1') => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
    </Routes>
  </MemoryRouter>,
);

describe('EpisodeDetail — Track 6 CP14 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('?tab=checklist renders the production checklist', async () => {
    renderEpisodeDetail('/episodes/ep-1?tab=checklist');

    await waitFor(() => expect(screen.getByTestId('episode-checklist')).toBeTruthy());
    expect(screen.queryByTestId('episode-todo-overlays')).toBeNull();
  });

  // Evoni, 2026-10-17: a bare URL opens Production on its Scenes workspace.
  test('rendering with no tab shows the Overview (Evoni, 2026-11-12; it was the Scenes workspace)', async () => {
    renderEpisodeDetail();

    await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
    expect(screen.queryByTestId('episode-scenes')).toBeNull();
    expect(screen.getByTitle('Overview').className).toContain('ed-tab-active');
    expect(screen.getByTitle('Production').className).not.toContain('ed-tab-active');
  });

  test('explicit overview tab still shows the Overview body', async () => {
    renderEpisodeDetail('/episodes/ep-1?tab=overview');

    await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
    expect(screen.queryByTestId('episode-checklist')).toBeNull();
  });

  // Evoni, 2026-10-17: Files (the raw clips) is under Production.
  test('?tab=files lands on Production -> Files', async () => {
    renderEpisodeDetail('/episodes/ep-1?tab=files');

    await waitFor(() => expect(screen.getByTestId('episode-assets')).toBeTruthy());
    expect(screen.queryByTestId('episode-checklist')).toBeNull();
    expect(screen.queryByTestId('episode-overview')).toBeNull();
    expect(screen.getByTitle('Production').className).toContain('ed-tab-active');
  });

  test('the Checklist is one pill away from Files', async () => {
    renderEpisodeDetail('/episodes/ep-1?tab=files');
    await waitFor(() => expect(screen.getByTestId('episode-assets')).toBeTruthy());

    fireEvent.click(within(screen.getByTestId('ed-subtabs')).getByRole('button', { name: 'Checklist' }));

    await waitFor(() => expect(screen.getByTestId('episode-checklist')).toBeTruthy());
    expect(screen.queryByTestId('episode-assets')).toBeNull();
  });

  test('Production from Overview opens on Scenes', async () => {
    renderEpisodeDetail('/episodes/ep-1?tab=overview');
    await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());

    fireEvent.click(screen.getByTitle('Production'));
    await waitFor(() => expect(screen.getByTestId('episode-scenes')).toBeTruthy());
    expect(screen.queryByTestId('episode-assets')).toBeNull();
  });

  // ── Loaders ─────────────────────────────────────────────────────────────

  test('listEpisodeLibraryScenesApi GET on /episodes/:id/library-scenes (4× reuse helper)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    const out = await listEpisodeLibraryScenesApi('ep-1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/library-scenes');
    expect(out).toEqual({ data: [] });
  });

  test('listWorldEventsApi GET on /world/:show/events (CP13 dup, 2-fold)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { events: [] } });
    await listWorldEventsApi('s-1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/s-1/events');
  });

  test('getCharacterStateApi GET on /characters/:char/state with show_id query', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { state: {} } });
    await getCharacterStateApi('lala', 's-1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/characters/lala/state?show_id=s-1');
  });

  // ── Mutators ────────────────────────────────────────────────────────────

  test('addEpisodeLibrarySceneApi POST on /episodes/:id/library-scenes', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'sc-new' } } });
    const payload = { sceneLibraryId: 'lib-1', trimStart: 0, trimEnd: 30 };
    await addEpisodeLibrarySceneApi('ep-1', payload);
    expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/library-scenes', payload);
  });

  test('reorderEpisodeLibrarySceneApi PUT on /episodes/:id/library-scenes/:sceneId (2× reuse helper)', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    await reorderEpisodeLibrarySceneApi('ep-1', 'sc-1', { sceneOrder: 2 });
    expect(api.put).toHaveBeenCalledWith(
      '/api/v1/episodes/ep-1/library-scenes/sc-1',
      { sceneOrder: 2 },
    );
  });

  test('removeEpisodeLibrarySceneApi DELETE on /episodes/:id/library-scenes/:sceneId', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    await removeEpisodeLibrarySceneApi('ep-1', 'sc-1');
    expect(api.delete).toHaveBeenCalledWith('/api/v1/episodes/ep-1/library-scenes/sc-1');
  });

  // ── Helper-reuse coverage ──────────────────────────────────────────────

  describe('Helper-reuse density (v2.21 observation candidate)', () => {
    test('listEpisodeLibraryScenesApi reused 4× across mount + 3 reload-after-mutation paths', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
      // Simulate the 4 invocation contexts in EpisodeDetail.jsx:
      // 1. fetchEpisodeScenes (initial mount on tab='scenes')
      // 2. handleSceneSelect reload (after addEpisodeLibrarySceneApi)
      // 3. handleReorderScene reload (after Promise.all PUT pair)
      // 4. handleRemoveScene reload (after removeEpisodeLibrarySceneApi)
      await listEpisodeLibraryScenesApi('ep-1');
      await listEpisodeLibraryScenesApi('ep-1');
      await listEpisodeLibraryScenesApi('ep-1');
      await listEpisodeLibraryScenesApi('ep-1');
      expect(api.get).toHaveBeenCalledTimes(4);
      // All 4 calls hit the same URL — confirms helper reuse not divergence.
      const allCalls = vi.mocked(api.get).mock.calls;
      allCalls.forEach((args) => {
        expect(args[0]).toBe('/api/v1/episodes/ep-1/library-scenes');
      });
    });

    test('reorderEpisodeLibrarySceneApi reused 2× in Promise.all pair (drag-reorder swap)', async () => {
      vi.mocked(api.put).mockResolvedValue({ data: {} });
      // Simulate the call-site shape (handleReorderScene drag swap):
      // await Promise.all([
      //   reorderEpisodeLibrarySceneApi(epId, scene[i].id, { sceneOrder: i + 1 }),
      //   reorderEpisodeLibrarySceneApi(epId, scene[targetIndex].id, { sceneOrder: targetIndex + 1 }),
      // ]);
      await Promise.all([
        reorderEpisodeLibrarySceneApi('ep-1', 'sc-A', { sceneOrder: 2 }),
        reorderEpisodeLibrarySceneApi('ep-1', 'sc-B', { sceneOrder: 1 }),
      ]);
      expect(api.put).toHaveBeenCalledTimes(2);
      expect(api.put).toHaveBeenNthCalledWith(
        1,
        '/api/v1/episodes/ep-1/library-scenes/sc-A',
        { sceneOrder: 2 },
      );
      expect(api.put).toHaveBeenNthCalledWith(
        2,
        '/api/v1/episodes/ep-1/library-scenes/sc-B',
        { sceneOrder: 1 },
      );
    });
  });

  // ── Error path propagation ─────────────────────────────────────────────

  describe('Error path propagation', () => {
    test('listEpisodeLibraryScenesApi rejection propagates (caller toasts via showError)', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('not authorized'));
      await expect(listEpisodeLibraryScenesApi('ep-1')).rejects.toThrow('not authorized');
    });

    test('listWorldEventsApi rejection propagates (caller logs)', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('not authorized'));
      await expect(listWorldEventsApi('s-1')).rejects.toThrow('not authorized');
    });

    test('getCharacterStateApi rejection propagates (caller logs)', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('not authorized'));
      await expect(getCharacterStateApi('lala', 's-1')).rejects.toThrow('not authorized');
    });

    test('addEpisodeLibrarySceneApi rejection propagates (caller alerts)', async () => {
      vi.mocked(api.post).mockRejectedValue(new Error('forbidden'));
      await expect(addEpisodeLibrarySceneApi('ep-1', {})).rejects.toThrow('forbidden');
    });

    test('reorderEpisodeLibrarySceneApi rejection propagates from Promise.all', async () => {
      vi.mocked(api.put).mockRejectedValue(new Error('conflict'));
      await expect(
        Promise.all([
          reorderEpisodeLibrarySceneApi('ep-1', 'sc-A', { sceneOrder: 2 }),
          reorderEpisodeLibrarySceneApi('ep-1', 'sc-B', { sceneOrder: 1 }),
        ]),
      ).rejects.toThrow('conflict');
    });

    test('removeEpisodeLibrarySceneApi rejection propagates (caller catches → no reload)', async () => {
      vi.mocked(api.delete).mockRejectedValue(new Error('not found'));
      await expect(removeEpisodeLibrarySceneApi('ep-1', 'missing')).rejects.toThrow('not found');
    });
  });
});

// Task #2356: the header shows the episode's source event (the anchor from
// episode_briefs.event_id, §8(w) P2) and links to its Event Package.
describe('EpisodeDetail — source event link (Task #2356)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  function mockEvents(events) {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/events') return { data: { success: true, events } };
      return { data: {} };
    });
  }

  test('the header links to the anchor event\'s Event Package', async () => {
    mockEvents([
      { id: 'ev-anchor', name: 'Maison Belle Gala', show_id: 'show-1', link: { anchor: true, anchor_source: 'brief' } },
      { id: 'ev-extra', name: 'Morning Brunch', show_id: 'show-1', link: { anchor: false } },
    ]);
    renderEpisodeDetail('/episodes/ep-1?tab=overview');

    const link = await screen.findByTestId('ed-source-event');
    expect(link.getAttribute('href')).toBe('/shows/show-1/events/ev-anchor');
    expect(link.textContent).toContain('Maison Belle Gala');
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/events');
  });

  test('no anchor event, no link', async () => {
    mockEvents([{ id: 'ev-extra', name: 'Morning Brunch', show_id: 'show-1', link: { anchor: false } }]);
    renderEpisodeDetail('/episodes/ep-1?tab=overview');

    await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/events'));
    expect(screen.queryByTestId('ed-source-event')).toBeNull();
  });

  test('a failed events read leaves the page up with no link', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/events') throw new Error('boom');
      return { data: {} };
    });
    renderEpisodeDetail('/episodes/ep-1?tab=overview');

    await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
    expect(screen.queryByTestId('ed-source-event')).toBeNull();
  });
});

// PR-03 (Evoni, 2026-11-18): opening an episode remembers it as the one last
// opened, under the browser key the page has always written. That is the
// episode to resume; it is never the show's official production episode.
const realSetItem = Storage.prototype.setItem;

describe('EpisodeDetail — opening an episode remembers it, and only that', () => {
  const E1 = { id: 'ep-1', title: 'Episode One', show_id: 'show-1', show: { id: 'show-1' }, status: 'in_build', episode_number: 1, season_number: 1 };
  const E2 = { id: 'ep-2', title: 'Second Look', show_id: 'show-1', show: { id: 'show-1' }, status: 'draft', episode_number: 2, season_number: 1 };
  const SHOW = [E2, E1];
  const workingKeys = () => Object.keys(window.localStorage).filter((k) => k.startsWith('working-episode')).sort();
  const open = (episode) => {
    vi.mocked(episodeService.getEpisode).mockResolvedValueOnce(episode);
    return renderEpisodeDetail(`/episodes/${episode.id}`);
  };

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    window.localStorage.clear();
  });

  test('opening Episode 2 writes the existing working-episode-id key, with its title beside it', async () => {
    expect(rememberedEpisodeId()).toBeNull();
    open(E2);
    await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());

    await waitFor(() => expect(window.localStorage.getItem('working-episode-id')).toBe('ep-2'));
    expect(window.localStorage.getItem('working-episode-title')).toBe('Second Look');
    expect(rememberedEpisodeId()).toBe('ep-2');
  });

  test('Episode 1 is still the official production episode; Episode 2 is only the one to resume', async () => {
    open(E2);
    await waitFor(() => expect(window.localStorage.getItem('working-episode-id')).toBe('ep-2'));

    expect(productionEpisode(SHOW).id).toBe('ep-1');
    expect(resumeEpisode(SHOW, rememberedEpisodeId()).id).toBe('ep-2');
  });

  test('opening on the Overview stores the two episode keys and the show (its existing key), and nothing else', async () => {
    const written = [];
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(key, value) {
      written.push(String(key));
      // Keep the write, so what is stored can be read back below.
      return Reflect.apply(realSetItem, this, [key, value]);
    });
    try {
      open(E2);
      await waitFor(() => expect(window.localStorage.getItem('working-episode-id')).toBe('ep-2'));
    } finally { spy.mockRestore(); }

    expect(workingKeys()).toEqual(['working-episode-id', 'working-episode-title']);
    // Everything the page stored while opening the episode. Since PR-04 the
    // show being worked on follows the episode, in the key it always had;
    // the Overview is not a working location, so no location is stored.
    const all = ['primeStudios.activeShowId', 'working-episode-id', 'working-episode-title'];
    expect([...new Set(written)].sort()).toEqual(all);
    expect(Object.keys(window.localStorage).sort()).toEqual(all);
  });

  test('opening Episode 1 afterwards replaces the same key; it does not add one', async () => {
    const first = open(E2);
    await waitFor(() => expect(window.localStorage.getItem('working-episode-id')).toBe('ep-2'));
    first.unmount();

    open(E1);
    await waitFor(() => expect(window.localStorage.getItem('working-episode-id')).toBe('ep-1'));
    expect(window.localStorage.getItem('working-episode-title')).toBe('Episode One');
    expect(workingKeys()).toEqual(['working-episode-id', 'working-episode-title']);
    expect(productionEpisode(SHOW).id).toBe('ep-1');
    expect(resumeEpisode(SHOW, rememberedEpisodeId()).id).toBe('ep-1');
  });

  test('an episode with no title is remembered as "Untitled"', async () => {
    open({ ...E2, title: '' });
    await waitFor(() => expect(window.localStorage.getItem('working-episode-id')).toBe('ep-2'));
    expect(window.localStorage.getItem('working-episode-title')).toBe('Untitled');
  });

  test('storage that cannot be written: the episode still opens', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      open(E2);
      await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Second Look');
    } finally { spy.mockRestore(); warn.mockRestore(); }
    expect(workingKeys()).toEqual([]);
  });
});

// PR-04 (Evoni, 2026-11-18): the last working location inside each episode,
// the show that follows the episode, and a deleted episode as not found.
// The address alone decides the tab: nothing here ever changes it.
describe('EpisodeDetail — the resume location, the show, and a deleted episode', () => {
  const E1 = { id: 'ep-1', title: 'Episode One', show_id: 'show-1', show: { id: 'show-1' }, status: 'in_build', episode_number: 1, season_number: 1 };
  const E2 = { id: 'ep-2', title: 'Second Look', show_id: 'show-1', show: { id: 'show-1' }, status: 'draft', episode_number: 2, season_number: 1 };
  const OTHER = { id: 'ep-9', title: 'Other Show', show_id: 'show-2', show: { id: 'show-2' }, status: 'draft', episode_number: 1, season_number: 1 };
  const BY_ID = { 'ep-1': E1, 'ep-2': E2, 'ep-9': OTHER };
  const SHOW_KEY = 'primeStudios.activeShowId';
  const LOCATIONS = 'working-episode-locations';

  const Where = () => {
    const l = useLocation();
    const navigate = useNavigate();
    return (
      <>
        <p data-testid="where">{l.pathname + l.search}</p>
        <button type="button" onClick={() => navigate(-1)}>history back</button>
        <button type="button" onClick={() => navigate(1)}>history forward</button>
      </>
    );
  };
  const mount = (entry) => render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/episodes/:episodeId" element={<><EpisodeDetail /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  const where = () => screen.getByTestId('where').textContent;
  const loaded = () => waitFor(() => expect(screen.getByTitle('Overview')).toBeTruthy());
  const failWith = (err) => vi.mocked(episodeService.getEpisode).mockRejectedValue(err);
  const http = (status) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    window.localStorage.clear();
    mockToast.showError.mockClear();
    vi.mocked(episodeService.getEpisode).mockReset();
    vi.mocked(episodeService.getEpisode).mockImplementation(async (id) => BY_ID[id] || E1);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // The file's own default, for the tests that rely on it.
    vi.mocked(episodeService.getEpisode).mockReset();
    vi.mocked(episodeService.getEpisode).mockResolvedValue({ id: 'ep-1', title: 'Episode One', show_id: 'show-1', show: { id: 'show-1' } });
  });

  describe('what is remembered', () => {
    test('each working tab and view, by the key in the address', async () => {
      for (const tab of ['scripts', 'wardrobe', 'lookbook', 'phone', 'overlays', 'money', 'checklist', 'scenes', 'beatplan', 'files', 'edit', 'summary', 'evaluation', 'story', 'distribution']) {
        window.localStorage.clear();
        const view = mount(`/episodes/ep-1?tab=${tab}`);
        await loaded();
        await waitFor(() => expect(episodeLocation('ep-1')?.tab).toBe(tab));
        expect(where()).toBe(`/episodes/ep-1?tab=${tab}`);
        view.unmount();
      }
    });

    test('a main tab is remembered as the view it opens on, and an old key as where it lands', async () => {
      for (const [param, tab] of [['production', 'scenes'], ['results', 'summary'], ['assets', 'scenes']]) {
        window.localStorage.clear();
        const view = mount(`/episodes/ep-1?tab=${param}`);
        await loaded();
        await waitFor(() => expect(episodeLocation('ep-1')?.tab).toBe(tab));
        // The address is left as it was typed.
        expect(where()).toBe(`/episodes/ep-1?tab=${param}`);
        view.unmount();
      }
    });

    test('the Overview is not remembered: no tab, ?tab=overview, the old Brief key, or a tab that does not exist', async () => {
      for (const entry of ['/episodes/ep-1', '/episodes/ep-1?tab=overview', '/episodes/ep-1?tab=brief', '/episodes/ep-1?tab=not-a-tab', '/episodes/ep-1?tab=']) {
        window.localStorage.clear();
        const view = mount(entry);
        await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
        await waitFor(() => expect(rememberedEpisodeId()).toBe('ep-1'));
        expect(window.localStorage.getItem(LOCATIONS)).toBeNull();
        view.unmount();
      }
    });

    test('opening the Overview does not replace a saved working location', async () => {
      rememberEpisodeLocation('ep-1', 'wardrobe', {}, 1000);
      mount('/episodes/ep-1');
      await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
      await waitFor(() => expect(rememberedEpisodeId()).toBe('ep-1'));
      expect(episodeLocation('ep-1')).toEqual({ tab: 'wardrobe', at: 1000 });
    });

    test('Voice is not remembered for someone who is not an admin, and what was saved stays', async () => {
      rememberEpisodeLocation('ep-1', 'files', {}, 1000);
      mount('/episodes/ep-1?tab=voice');
      await loaded();
      await waitFor(() => expect(rememberedEpisodeId()).toBe('ep-1'));
      expect(episodeLocation('ep-1', { voiceStudio: true })).toEqual({ tab: 'files', at: 1000 });
      // The address is honoured all the same.
      expect(where()).toBe('/episodes/ep-1?tab=voice');
      expect(api.get).not.toHaveBeenCalledWith('/api/v1/voice-studio/status');
    });

    test('each episode keeps its own, in one show and across shows', async () => {
      for (const [id, tab] of [['ep-1', 'wardrobe'], ['ep-2', 'scripts'], ['ep-9', 'distribution']]) {
        const view = mount(`/episodes/${id}?tab=${tab}`);
        await loaded();
        await waitFor(() => expect(episodeLocation(id)?.tab).toBe(tab));
        view.unmount();
      }
      expect(episodeLocation('ep-1').tab).toBe('wardrobe');
      expect(episodeLocation('ep-2').tab).toBe('scripts');
      expect(episodeLocation('ep-9').tab).toBe('distribution');
      // Last opened is the last one; the official production episode is still the first unfinished.
      expect(rememberedEpisodeId()).toBe('ep-9');
      expect(productionEpisode([E2, E1]).id).toBe('ep-1');
    });

    test('nothing is remembered under an address whose episode has not loaded', async () => {
      // The answer is for another episode than the address names.
      vi.mocked(episodeService.getEpisode).mockResolvedValue(E1);
      mount('/episodes/ep-2?tab=wardrobe');
      await loaded();
      expect(window.localStorage.getItem(LOCATIONS)).toBeNull();
      expect(window.localStorage.getItem(SHOW_KEY)).toBeNull();
    });

    test('storage that cannot be written does not stop the tab opening', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      mount('/episodes/ep-1?tab=checklist');
      await waitFor(() => expect(screen.getByTestId('episode-checklist')).toBeTruthy());
      expect(where()).toBe('/episodes/ep-1?tab=checklist');
    });
  });

  describe('the address decides; a saved location never moves the page', () => {
    beforeEach(() => { rememberEpisodeLocation('ep-1', 'wardrobe', {}, 1000); });

    test('a plain link opens the Overview, and the address is not changed', async () => {
      mount('/episodes/ep-1');
      await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
      await waitFor(() => expect(rememberedEpisodeId()).toBe('ep-1'));
      expect(where()).toBe('/episodes/ep-1');
      expect(screen.getByTitle('Overview').className).toContain('ed-tab-active');
    });

    test('a link that names a tab opens that tab, whatever was saved', async () => {
      mount('/episodes/ep-1?tab=checklist');
      await waitFor(() => expect(screen.getByTestId('episode-checklist')).toBeTruthy());
      expect(where()).toBe('/episodes/ep-1?tab=checklist');
      await waitFor(() => expect(episodeLocation('ep-1').tab).toBe('checklist'));
    });

    test('opening it again at the same address (a refresh) shows the same tab', async () => {
      const first = mount('/episodes/ep-1?tab=files');
      await waitFor(() => expect(screen.getByTestId('episode-assets')).toBeTruthy());
      first.unmount();
      mount('/episodes/ep-1?tab=files');
      await waitFor(() => expect(screen.getByTestId('episode-assets')).toBeTruthy());
      expect(where()).toBe('/episodes/ep-1?tab=files');
    });

    test('a click, then Back and Forward: the page follows the address each time, and the last one visited is what is saved', async () => {
      mount('/episodes/ep-1?tab=files');
      await waitFor(() => expect(screen.getByTestId('episode-assets')).toBeTruthy());
      fireEvent.click(within(screen.getByTestId('ed-subtabs')).getByRole('button', { name: 'Checklist' }));
      await waitFor(() => expect(screen.getByTestId('episode-checklist')).toBeTruthy());
      expect(where()).toBe('/episodes/ep-1?tab=checklist');
      await waitFor(() => expect(episodeLocation('ep-1').tab).toBe('checklist'));

      fireEvent.click(screen.getByRole('button', { name: 'history back' }));
      await waitFor(() => expect(screen.getByTestId('episode-assets')).toBeTruthy());
      expect(where()).toBe('/episodes/ep-1?tab=files');
      await waitFor(() => expect(episodeLocation('ep-1').tab).toBe('files'));

      fireEvent.click(screen.getByRole('button', { name: 'history forward' }));
      await waitFor(() => expect(screen.getByTestId('episode-checklist')).toBeTruthy());
      expect(where()).toBe('/episodes/ep-1?tab=checklist');
      await waitFor(() => expect(episodeLocation('ep-1').tab).toBe('checklist'));
    });

    test('going from a working tab to the Overview keeps the working tab as the saved location', async () => {
      mount('/episodes/ep-1?tab=files');
      await waitFor(() => expect(episodeLocation('ep-1').tab).toBe('files'));
      fireEvent.click(screen.getByTitle('Overview'));
      await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
      expect(where()).toBe('/episodes/ep-1?tab=overview');
      expect(episodeLocation('ep-1').tab).toBe('files');
    });
  });

  describe('the show follows the episode', () => {
    test('opening an episode remembers its show, in the show\'s existing key', async () => {
      mount('/episodes/ep-9');
      await waitFor(() => expect(window.localStorage.getItem(SHOW_KEY)).toBe('show-2'));
      expect(Object.keys(window.localStorage).filter((k) => /show/i.test(k))).toEqual([SHOW_KEY]);
    });

    test('an episode with no show leaves the remembered show alone', async () => {
      window.localStorage.setItem(SHOW_KEY, 'show-1');
      vi.mocked(episodeService.getEpisode).mockResolvedValue({ id: 'ep-1', title: 'Loose', status: 'draft' });
      mount('/episodes/ep-1');
      await waitFor(() => expect(rememberedEpisodeId()).toBe('ep-1'));
      expect(window.localStorage.getItem(SHOW_KEY)).toBe('show-1');
    });

    test('it is written once per episode: a later choice of show elsewhere is not put back by moving between tabs', async () => {
      mount('/episodes/ep-1?tab=files');
      await waitFor(() => expect(window.localStorage.getItem(SHOW_KEY)).toBe('show-1'));
      // Another window chooses another show.
      window.localStorage.setItem(SHOW_KEY, 'show-2');
      fireEvent.click(within(screen.getByTestId('ed-subtabs')).getByRole('button', { name: 'Checklist' }));
      await waitFor(() => expect(episodeLocation('ep-1').tab).toBe('checklist'));
      fireEvent.click(screen.getByTitle('Overview'));
      await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
      expect(window.localStorage.getItem(SHOW_KEY)).toBe('show-2');
    });

    test('a show named in the address still comes first', async () => {
      mount('/episodes/ep-9');
      await waitFor(() => expect(window.localStorage.getItem(SHOW_KEY)).toBe('show-2'));
      const shows = [{ id: 'show-1' }, { id: 'show-2' }];
      expect(activeShowId({ pathname: '/shows/show-1/season', shows })).toBe('show-1');
      expect(activeShowId({ pathname: '/', shows })).toBe('show-2');
    });

    test('an episode that fails to load does not change the remembered show', async () => {
      window.localStorage.setItem(SHOW_KEY, 'show-1');
      failWith(http(500));
      mount('/episodes/ep-9');
      await screen.findByText('Episode Not Found');
      expect(window.localStorage.getItem(SHOW_KEY)).toBe('show-1');
    });
  });

  describe('a deleted episode is not found', () => {
    const seed = () => {
      window.localStorage.setItem(SHOW_KEY, 'show-1');
      window.localStorage.setItem('authToken', 'token');
      window.localStorage.setItem('esp-draft-ep-2', 'an unsaved script');
      rememberEpisode(E2);
      rememberEpisodeLocation('ep-1', 'wardrobe', {}, 1000);
      rememberEpisodeLocation('ep-2', 'scripts', {}, 2000);
      rememberEpisodeLocation('ep-9', 'money', {}, 3000);
    };
    const othersKept = () => {
      expect(episodeLocation('ep-1')).toEqual({ tab: 'wardrobe', at: 1000 });
      expect(episodeLocation('ep-9')).toEqual({ tab: 'money', at: 3000 });
      expect(window.localStorage.getItem(SHOW_KEY)).toBe('show-1');
      expect(window.localStorage.getItem('authToken')).toBe('token');
      expect(window.localStorage.getItem('esp-draft-ep-2')).toBe('an unsaved script');
    };

    test('the read answers with it marked deleted: it is not shown, the list of shows opens, and only it is forgotten', async () => {
      seed();
      vi.mocked(episodeService.getEpisode).mockResolvedValue({ ...E2, deleted_at: '2026-11-10T09:00:00.000Z' });
      mount('/episodes/ep-2?tab=scripts');

      await waitFor(() => expect(where()).toBe('/shows'));
      expect(mockToast.showError).toHaveBeenCalledWith('Episode not found — it may have been deleted.');
      expect(screen.queryByTitle('Overview')).toBeNull();
      expect(rememberedEpisodeId()).toBeNull();
      expect(window.localStorage.getItem('working-episode-title')).toBeNull();
      expect(episodeLocation('ep-2')).toBeNull();
      othersKept();
    });

    test('a deleted episode that was not the one last opened: "last opened" is left alone', async () => {
      seed();
      vi.mocked(episodeService.getEpisode).mockResolvedValue({ ...E1, deleted_at: '2026-11-10T09:00:00.000Z' });
      mount('/episodes/ep-1');
      await waitFor(() => expect(where()).toBe('/shows'));
      expect(rememberedEpisodeId()).toBe('ep-2');
      expect(episodeLocation('ep-1')).toBeNull();
      expect(episodeLocation('ep-2')).toEqual({ tab: 'scripts', at: 2000 });
    });

    test('an episode that is not deleted opens as before (deleted_at empty or absent)', async () => {
      for (const deleted_at of [null, undefined, '']) {
        vi.mocked(episodeService.getEpisode).mockResolvedValue({ ...E2, deleted_at });
        const view = mount('/episodes/ep-2');
        await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
        expect(where()).toBe('/episodes/ep-2');
        view.unmount();
      }
    });

    test('the server says it does not exist (404): the list of shows opens, and only it is forgotten', async () => {
      seed();
      failWith(http(404));
      mount('/episodes/ep-2');
      await waitFor(() => expect(where()).toBe('/shows'));
      expect(rememberedEpisodeId()).toBeNull();
      expect(episodeLocation('ep-2')).toBeNull();
      othersKept();
    });

    test('deleting it from the page forgets it, and only it', async () => {
      seed();
      episodeService.deleteEpisode = vi.fn().mockResolvedValue({});
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mount('/episodes/ep-2?tab=overview');
      fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
      fireEvent.click(await screen.findByText('Delete Episode'));
      await waitFor(() => expect(where()).toBe('/shows/show-1/season?tab=episodes'));
      expect(episodeService.deleteEpisode).toHaveBeenCalledWith('ep-2');
      expect(rememberedEpisodeId()).toBeNull();
      expect(episodeLocation('ep-2')).toBeNull();
      othersKept();
    });

    test('a delete that is refused forgets nothing', async () => {
      seed();
      episodeService.deleteEpisode = vi.fn().mockRejectedValue(http(409));
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mount('/episodes/ep-2?tab=overview');
      fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
      fireEvent.click(await screen.findByText('Delete Episode'));
      await waitFor(() => expect(episodeService.deleteEpisode).toHaveBeenCalled());
      await waitFor(() => expect(mockToast.showError).toHaveBeenCalled());
      expect(rememberedEpisodeId()).toBe('ep-2');
      expect(episodeLocation('ep-2')).toEqual({ tab: 'scripts', at: 2000 });
    });
  });

  describe('a failure that is not "it does not exist" forgets nothing', () => {
    const seed = () => {
      rememberEpisode(E2);
      rememberEpisodeLocation('ep-2', 'scripts', {}, 2000);
      window.localStorage.setItem(SHOW_KEY, 'show-1');
    };
    const allKept = () => {
      expect(rememberedEpisodeId()).toBe('ep-2');
      expect(window.localStorage.getItem('working-episode-title')).toBe('Second Look');
      expect(episodeLocation('ep-2')).toEqual({ tab: 'scripts', at: 2000 });
      expect(window.localStorage.getItem(SHOW_KEY)).toBe('show-1');
    };

    test('a network error, a server failure, a refusal and a timeout: the error is shown and everything is kept', async () => {
      const failures = [
        new Error('Network Error'),
        http(500), http(502), http(503),
        http(401), http(403),
        Object.assign(new Error('timeout of 180000ms exceeded'), { code: 'ECONNABORTED' }),
      ];
      for (const err of failures) {
        window.localStorage.clear();
        seed();
        failWith(err);
        const view = mount('/episodes/ep-2?tab=wardrobe');
        await screen.findByText('Episode Not Found');
        expect(where()).toBe('/episodes/ep-2?tab=wardrobe');
        allKept();
        view.unmount();
      }
    });

    test('an error that only reads like "404", with no answer from the server, redirects as before but forgets nothing', async () => {
      seed();
      failWith(new Error('Not Found'));
      mount('/episodes/ep-2');
      await waitFor(() => expect(where()).toBe('/shows'));
      allKept();
    });

    test('an address that is not an episode id forgets nothing', async () => {
      seed();
      failWith(new Error('Invalid episode ID: nope'));
      mount('/episodes/nope');
      await screen.findByText('Episode Not Found');
      allKept();
    });
  });
});

describe('EpisodeDetail — Edit details carries the tab it is opened from (PR-05)', () => {
  const EP = '11111111-2222-4333-8444-555555555555';
  const EPISODE = { id: EP, title: 'Episode One', show_id: 'show-1', show: { id: 'show-1' }, status: 'in_build', episode_number: 1, season_number: 1 };
  const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; };
  const mount = (entry) => render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/episodes/:episodeId" element={<><EpisodeDetail /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  const where = () => screen.getByTestId('where').textContent;
  const openEdit = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('button', { name: /Edit Episode/ }));
  };
  const origin = (tab, label) => `?from=${encodeURIComponent(`/episodes/${EP}?tab=${tab}`)}&fromLabel=${encodeURIComponent(label)}`;

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    window.localStorage.clear();
    vi.mocked(episodeService.getEpisode).mockReset();
    vi.mocked(episodeService.getEpisode).mockResolvedValue(EPISODE);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    // The page is taken down before the mocks lose their answers.
    cleanup();
    vi.restoreAllMocks();
    vi.mocked(episodeService.getEpisode).mockReset();
    vi.mocked(episodeService.getEpisode).mockResolvedValue({ id: 'ep-1', title: 'Episode One', show_id: 'show-1', show: { id: 'show-1' } });
  });

  test('from the Overview: the plain address, as before', async () => {
    for (const entry of [`/episodes/${EP}`, `/episodes/${EP}?tab=overview`, `/episodes/${EP}?tab=nope`]) {
      const view = mount(entry);
      await openEdit();
      await waitFor(() => expect(where()).toBe(`/episodes/${EP}/edit`));
      view.unmount();
    }
  });

  test('from a working tab: the address carries that tab and its name', async () => {
    for (const [tab, label] of [['scripts', 'Script'], ['wardrobe', 'Wardrobe'], ['checklist', 'Checklist'], ['money', 'Money'], ['beatplan', 'Plan'], ['files', 'Files'], ['distribution', 'Distribution']]) {
      const view = mount(`/episodes/${EP}?tab=${tab}`);
      await openEdit();
      await waitFor(() => expect(where()).toBe(`/episodes/${EP}/edit${origin(tab, label)}`));
      view.unmount();
    }
  });

  // Results' Summary and Story need more than this file mocks; tabOrigin's own tests cover every tab.
  test('a main tab, or an old key, carries the view it opens on', async () => {
    for (const [param, tab, label] of [['production', 'scenes', 'Scenes'], ['assets', 'scenes', 'Scenes']]) {
      const view = mount(`/episodes/${EP}?tab=${param}`);
      await openEdit();
      await waitFor(() => expect(where()).toBe(`/episodes/${EP}/edit${origin(tab, label)}`));
      view.unmount();
    }
  });

  test('what the address carries is read back by Edit details as that tab', async () => {
    mount(`/episodes/${EP}?tab=checklist`);
    await openEdit();
    await waitFor(() => expect(where()).toContain('/edit?from='));
    const back = readReturn(new URLSearchParams(where().split('?')[1]), { episodeId: EP, fallback: { href: 'x', text: 'x' } });
    expect(back).toEqual({ href: `/episodes/${EP}?tab=checklist`, text: 'Back to Checklist', origin: true });
  });

  test('opening Edit details makes no request and stores nothing new', async () => {
    mount(`/episodes/${EP}?tab=checklist`);
    await screen.findByRole('button', { name: 'More actions' });
    await new Promise((r) => setTimeout(r, 20));
    const calls = ['get', 'post', 'put', 'patch', 'delete'].map((m) => vi.mocked(api[m]).mock.calls.length);
    const keys = Object.keys(window.localStorage).sort();
    await openEdit();
    await waitFor(() => expect(where()).toContain('/edit?from='));
    expect(['get', 'post', 'put', 'patch', 'delete'].map((m) => vi.mocked(api[m]).mock.calls.length)).toEqual(calls);
    expect(Object.keys(window.localStorage).sort()).toEqual(keys);
  });
});

/**
 * The production strip is not on the Checklist (Evoni, 2026-11-27): there it
 * repeated what the Hub already says — the seven steps are its stage bands,
 * and the count is its summary. The strip itself is unchanged and still
 * shows on every other Production view, so nothing about it is lost; only
 * where it is drawn has changed.
 */
describe('EpisodeDetail — the production strip is off the Checklist, and only the Checklist', () => {
  const EP = '11111111-2222-4333-8444-555555555555';
  const EPISODE = { id: EP, title: 'Episode One', show_id: 'show-1', show: { id: 'show-1' }, status: 'in_build', episode_number: 1, season_number: 1 };
  const mount = (entry) => render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/episodes/:episodeId" element={<EpisodeDetail />} /></Routes>
    </MemoryRouter>,
  );

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    window.localStorage.clear();
    vi.mocked(episodeService.getEpisode).mockReset();
    vi.mocked(episodeService.getEpisode).mockResolvedValue(EPISODE);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.mocked(episodeService.getEpisode).mockReset();
    vi.mocked(episodeService.getEpisode).mockResolvedValue({ id: 'ep-1', title: 'Episode One', show_id: 'show-1', show: { id: 'show-1' } });
  });

  test('every other Production view still shows it', async () => {
    for (const tab of ['scenes', 'wardrobe', 'lookbook', 'phone', 'overlays', 'money', 'files', 'beatplan', 'edit']) {
      const view = mount(`/episodes/${EP}?tab=${tab}`);
      expect(await screen.findByTestId('ed-prodhead-wrap')).toBeTruthy();
      view.unmount();
    }
  });

  test('the Checklist does not, and waiting does not bring it back', async () => {
    mount(`/episodes/${EP}?tab=checklist`);
    // Wait for the page itself, so this is not merely "nothing has rendered".
    expect(await screen.findByTestId('ed-tabs')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('ed-prodhead-wrap')).toBeNull());
    expect(screen.queryByTestId('eph-now')).toBeNull();
    expect(screen.queryByTestId('eph-count')).toBeNull();
    expect(screen.queryByTestId('eph-mark-ready')).toBeNull();
  });

  test('what the strip offered is still reachable from the Checklist', async () => {
    mount(`/episodes/${EP}?tab=checklist`);
    // Mark Ready set the status to In review; the header's own control still
    // offers it, on this view as on any other.
    const status = await screen.findByTestId('ed-status');
    expect([...status.options].map((o) => o.value)).toContain('in_review');
    expect(status.disabled).toBe(false);
    // Open Editor is step 5's view, which the Hub's stage bands link to.
    expect(EP_TABS.find((t) => t.key === 'production').subs.some((x) => x.key === 'edit')).toBe(true);
  });
});

describe('EpisodeDetail — the Production header\'s Thumbnail step carries the open tab (PR-06)', () => {
  const EP = '11111111-2222-4333-8444-555555555555';
  const EPISODE = { id: EP, title: 'Episode One', show_id: 'show-1', show: { id: 'show-1' }, status: 'in_build', episode_number: 1, season_number: 1 };
  const mount = (entry) => render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/episodes/:episodeId" element={<EpisodeDetail />} /></Routes>
    </MemoryRouter>,
  );
  const thumbnailHref = async () => within(await screen.findByTestId('eph-step-thumbnail')).getByRole('link').getAttribute('href');

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    window.localStorage.clear();
    vi.mocked(episodeService.getEpisode).mockReset();
    vi.mocked(episodeService.getEpisode).mockResolvedValue(EPISODE);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    // The page is taken down before the mocks lose their answers.
    cleanup();
    vi.restoreAllMocks();
    vi.mocked(episodeService.getEpisode).mockReset();
    vi.mocked(episodeService.getEpisode).mockResolvedValue({ id: 'ep-1', title: 'Episode One', show_id: 'show-1', show: { id: 'show-1' } });
  });

  test('on each Production view, the step\'s address names that view', async () => {
    // The Checklist is not in this list any more: the strip is not shown
    // there (Evoni, 2026-11-27). The behaviour this case checks — the step's
    // address names the view it was opened from — is the same on the four
    // views that keep the strip.
    for (const [tab, label] of [['wardrobe', 'Wardrobe'], ['money', 'Money'], ['files', 'Files'], ['beatplan', 'Plan']]) {
      const view = mount(`/episodes/${EP}?tab=${tab}`);
      const href = await thumbnailHref();
      expect(href).toBe(`/template-studio/youtube?episode=${EP}&from=${encodeURIComponent(`/episodes/${EP}?tab=${tab}`)}&fromLabel=${label}`);
      expect(readReturn(new URLSearchParams(href.split('?')[1]), { episodeId: EP, fallback: { href: 'x', text: 'x' } }))
        .toEqual({ href: `/episodes/${EP}?tab=${tab}`, text: `Back to ${label}`, origin: true });
      view.unmount();
    }
  });

  test('Production opened by its main key, or an old one, names the view it opens on', async () => {
    for (const param of ['production', 'assets']) {
      const view = mount(`/episodes/${EP}?tab=${param}`);
      expect(await thumbnailHref()).toBe(`/template-studio/youtube?episode=${EP}&from=${encodeURIComponent(`/episodes/${EP}?tab=scenes`)}&fromLabel=Scenes`);
      view.unmount();
    }
  });

  test('nothing new is stored by showing the step', async () => {
    mount(`/episodes/${EP}?tab=wardrobe`);
    await thumbnailHref();
    expect(Object.keys(window.localStorage).sort()).toEqual(['primeStudios.activeShowId', 'working-episode-id', 'working-episode-locations', 'working-episode-title']);
  });
});

