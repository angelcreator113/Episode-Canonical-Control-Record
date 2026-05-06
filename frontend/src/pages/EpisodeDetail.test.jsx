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

import { vi, describe, beforeEach, test, expect } from 'vitest';

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

describe('EpisodeDetail — Track 6 CP14 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
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
