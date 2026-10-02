/**
 * EpisodeScenesTab — Track 6 CP5 module-scope helpers.
 *
 * Evoni's ruling L12 (2026-10-02, §8(hh)) made the tab the one scene
 * workspace and retired the scene-set picker, the angle suggestions and
 * "Use in Episode", with their helpers. These are the helpers it fetches
 * through now.
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
  listEpisodeScenesApi,
  deleteSceneApi,
  getEpisodePlanApi,
  lockAllBeatsApi,
  getEpisodeLocationsApi,
  saveEpisodeLocationsApi,
  retryFeedMomentsApi,
} from './EpisodeScenesTab';

describe('EpisodeScenesTab — Track 6 CP5 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listEpisodeScenesApi GET on /episodes/:episodeId/scenes', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [] } });
    await listEpisodeScenesApi('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/scenes');
  });

  test('deleteSceneApi DELETE on /scenes/:sceneId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
    await deleteSceneApi('scene-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scenes/scene-1');
  });

  test('getEpisodePlanApi GET on /episode-brief/:episodeId/plan', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await getEpisodePlanApi('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan');
  });

  test('lockAllBeatsApi POST on /episode-brief/:episodeId/plan/lock-all', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await lockAllBeatsApi('ep-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/lock-all');
  });

  test('getEpisodeLocationsApi and saveEpisodeLocationsApi use /episodes/:episodeId/locations', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await getEpisodeLocationsApi('ep-1');
    await saveEpisodeLocationsApi('ep-1', [{ role: 'home', scene_set_id: 'set-1' }]);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/locations');
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/episodes/ep-1/locations', { locations: [{ role: 'home', scene_set_id: 'set-1' }] });
  });

  test('retryFeedMomentsApi POST on /episode-brief/:episodeId/feed-moments/retry', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await retryFeedMomentsApi('ep-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/feed-moments/retry');
  });

  test('a rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
    await expect(listEpisodeScenesApi('missing')).rejects.toThrow('not found');
  });
});
