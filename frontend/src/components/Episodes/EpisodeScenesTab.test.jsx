/**
 * EpisodeScenesTab — Track 6 CP5 behavioral tests (file 2 of 3 in CP5 batch).
 *
 * 9 fetch sites migrated via 9 module-scope helpers. 6 file-local
 * (episode-scoped routes + scene routes); 3 intentionally duplicated locally
 * from CP2 SceneSetsTab.jsx (listSceneSetsApi, suggestAnglesApi,
 * createAngleApi) per Track 6 file-local convention.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../../services/api';
import {
  // Episode-scoped routes (file-local)
  listEpisodeSceneSetsApi,
  listEpisodeScenesApi,
  linkSceneSetsToEpisodeApi,
  unlinkSceneSetFromEpisodeApi,
  createSceneFromAngleApi,
  deleteSceneApi,
  // Scene-set routes (duplicated from CP2)
  listSceneSetsApi,
  suggestAnglesApi,
  createAngleApi,
} from './EpisodeScenesTab';

describe('EpisodeScenesTab — Track 6 CP5 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Episode-scoped routes', () => {
    test('listEpisodeSceneSetsApi GET on /episodes/:episodeId/scene-sets', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [] } });
      await listEpisodeSceneSetsApi('ep-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/scene-sets');
    });

    test('listEpisodeScenesApi GET on /episodes/:episodeId/scenes', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [] } });
      await listEpisodeScenesApi('ep-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/scenes');
    });

    test('linkSceneSetsToEpisodeApi POST on /episodes/:episodeId/scene-sets', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
      await linkSceneSetsToEpisodeApi('ep-1', { sceneSetIds: ['s-1', 's-2'] });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/episodes/ep-1/scene-sets',
        { sceneSetIds: ['s-1', 's-2'] },
      );
    });

    test('unlinkSceneSetFromEpisodeApi DELETE on /episodes/:episodeId/scene-sets/:setId', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
      await unlinkSceneSetFromEpisodeApi('ep-1', 's-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/episodes/ep-1/scene-sets/s-1');
    });

    test('createSceneFromAngleApi POST on /episodes/:episodeId/scenes/from-angle', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
      await createSceneFromAngleApi('ep-1', { sceneSetId: 's-1', sceneAngleId: 'a-1' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/episodes/ep-1/scenes/from-angle',
        { sceneSetId: 's-1', sceneAngleId: 'a-1' },
      );
    });

    test('deleteSceneApi DELETE on /scenes/:sceneId', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteSceneApi('sc-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scenes/sc-1');
    });
  });

  describe('Scene-set routes (duplicated from CP2)', () => {
    test('listSceneSetsApi GET on /scene-sets', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
      await listSceneSetsApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets');
    });

    test('suggestAnglesApi POST on /scene-sets/:setId/suggest-angles with empty body', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: [] } });
      await suggestAnglesApi('s-1', {});
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/s-1/suggest-angles',
        {},
      );
    });

    test('createAngleApi POST on /scene-sets/:setId/angles with angle payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
      const payload = {
        angle_name: 'wide',
        angle_label: 'Wide establishing',
        camera_direction: 'wide',
        mood: 'cinematic',
        beat_affinity: 'opening',
      };
      await createAngleApi('s-1', payload);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/s-1/angles',
        payload,
      );
    });
  });

  describe('Error path propagation', () => {
    test('listEpisodeSceneSetsApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(listEpisodeSceneSetsApi('missing')).rejects.toThrow('not found');
    });

    test('linkSceneSetsToEpisodeApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('conflict'));
      await expect(
        linkSceneSetsToEpisodeApi('ep-1', { sceneSetIds: [] })
      ).rejects.toThrow('conflict');
    });
  });
});
