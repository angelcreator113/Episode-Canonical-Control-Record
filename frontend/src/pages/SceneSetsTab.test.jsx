/**
 * SceneSetsTab — Track 6 CP2 behavioral tests.
 *
 * 64 fetch sites migrated via 39 module-scope helpers, organised by cluster:
 * scene-set CRUD, spec/refinement, style/location/base, generation, angles,
 * AI/suggestions, episode association, and external pickers.
 *
 * Helpers are exported with the Api suffix (Pattern F prophylactic) so they
 * never collide with component-local handler names like handleCreate,
 * handleDeleteSet, handleSetCoverAngle, handleAddAngle, handlePreviewPrompt,
 * handleUploadAngleImage, handleCascadeRegenerate, handleReorderAngle, etc.
 *
 * Spot-tests one helper per cluster plus signature variations (PATCH vs PUT,
 * FormData uploads, query-string vs path params, GET vs POST disambiguation).
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

import apiClient from '../services/api';
import {
  // Scene-set CRUD
  listSceneSetsApi,
  getSceneSetApi,
  createSceneSetApi,
  updateSceneSetApi,
  deleteSceneSetApi,
  getSceneSetJobApi,
  getGenerationCheckApi,
  // Spec / refinement
  refineSceneDescriptionApi,
  generateSceneSpecApi,
  createAnglesFromSpecApi,
  previewPromptApi,
  // Style / location / base
  lockSceneStyleApi,
  learnSceneLocationApi,
  promoteToBaseApi,
  setCoverAngleApi,
  // Generation
  generateBaseImageApi,
  uploadBaseImageApi,
  cascadeRegenerateApi,
  // Angles
  listAnglesApi,
  createAngleApi,
  getAngleApi,
  generateAngleApi,
  uploadAngleApi,
  regenerateAngleApi,
  submitAngleReviewApi,
  updateAngleApi,
  deleteAngleApi,
  deleteAllAnglesApi,
  reorderAnglesApi,
  generateAllAnglesApi,
  // AI / suggestions
  suggestAnglesApi,
  suggestAnglesFromImageApi,
  getAiCameraDirectionApi,
  getMoodVariantsApi,
  generateMoodVariantsApi,
  getComparisonApi,
  getWardrobeMatchApi,
  // Episode association
  listSceneSetEpisodesApi,
  unlinkEpisodeFromSceneSetApi,
  // External
  listShowsApi,
  listEpisodesByShowApi,
} from './SceneSetsTab';

describe('SceneSetsTab — Track 6 CP2 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Scene-set CRUD', () => {
    test('listSceneSetsApi GET without params hits bare /scene-sets', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
      await listSceneSetsApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets');
    });

    test('listSceneSetsApi GET with query string', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
      const qs = new URLSearchParams({ scene_type: 'CLOSET' }).toString();
      await listSceneSetsApi(qs);
      expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/scene-sets?${qs}`);
    });

    test('getSceneSetApi GET on /scene-sets/:id', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: {} } });
      await getSceneSetApi('set-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1');
    });

    test('createSceneSetApi POST on /scene-sets', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'new' } } });
      await createSceneSetApi({ name: 'Closet', scene_type: 'CLOSET' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets',
        { name: 'Closet', scene_type: 'CLOSET' },
      );
    });

    test('updateSceneSetApi PUT on /scene-sets/:id', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await updateSceneSetApi('set-1', { name: 'New Name' });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1',
        { name: 'New Name' },
      );
    });

    test('deleteSceneSetApi DELETE on /scene-sets/:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteSceneSetApi('set-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-1');
    });

    test('getSceneSetJobApi GET on /scene-sets/jobs/:jobId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { status: 'completed' } });
      await getSceneSetJobApi('job-42');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/jobs/job-42');
    });

    test('getGenerationCheckApi GET on /generation-check', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { allowed: true } });
      await getGenerationCheckApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/generation-check');
    });
  });

  describe('Spec / refinement', () => {
    test('refineSceneDescriptionApi POST with description payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await refineSceneDescriptionApi('set-1', { description: 'cozy bedroom' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/refine-description',
        { description: 'cozy bedroom' },
      );
    });

    test('generateSceneSpecApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await generateSceneSpecApi('set-1', {});
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/spec/generate',
        {},
      );
    });

    test('createAnglesFromSpecApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await createAnglesFromSpecApi('set-1', { angles: [] });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/spec/create-angles',
        { angles: [] },
      );
    });

    test('previewPromptApi GET (no body, no payload)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: 'prompt' } });
      await previewPromptApi('set-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/preview-prompt');
    });
  });

  describe('Style / location / base / cover', () => {
    test('lockSceneStyleApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await lockSceneStyleApi('set-1', { style_lock: true });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/lock-style',
        { style_lock: true },
      );
    });

    test('learnSceneLocationApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await learnSceneLocationApi('set-1', { location_id: 'L1' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/learn-location',
        { location_id: 'L1' },
      );
    });

    test('promoteToBaseApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await promoteToBaseApi('set-1', { angle_id: 'A1' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/promote-to-base',
        { angle_id: 'A1' },
      );
    });

    test('setCoverAngleApi PATCH (not GET) on /cover-angle', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
      await setCoverAngleApi('set-1', { angle_id: 'A1' });
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/cover-angle',
        { angle_id: 'A1' },
      );
    });
  });

  describe('Generation', () => {
    test('generateBaseImageApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { data: {} } });
      await generateBaseImageApi('set-1', {});
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/generate-base',
        {},
      );
    });

    test('uploadBaseImageApi POST with FormData', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      const formData = new FormData();
      formData.append('image', new Blob(['png-bytes']));
      await uploadBaseImageApi('set-1', formData);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/upload-base',
        formData,
      );
    });

    test('cascadeRegenerateApi POST with description payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { jobId: 'J1' } } });
      await cascadeRegenerateApi('set-1', { canonical_description: 'new desc' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/cascade-regenerate',
        { canonical_description: 'new desc' },
      );
    });
  });

  describe('Angles', () => {
    test('listAnglesApi GET on /angles', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
      await listAnglesApi('set-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/angles');
    });

    test('createAngleApi POST on /angles', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'A1' } } });
      await createAngleApi('set-1', { angle_label: 'wide' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/angles',
        { angle_label: 'wide' },
      );
    });

    test('getAngleApi GET on /angles/:angleId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: {} } });
      await getAngleApi('set-1', 'A1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/angles/A1');
    });

    test('generateAngleApi POST on /angles/:angleId/generate', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await generateAngleApi('set-1', 'A1', {});
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/angles/A1/generate',
        {},
      );
    });

    test('uploadAngleApi POST with FormData on /angles/:angleId/upload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      const formData = new FormData();
      formData.append('images', new Blob(['jpg-bytes']));
      await uploadAngleApi('set-1', 'A1', formData);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/angles/A1/upload',
        formData,
      );
    });

    test('regenerateAngleApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await regenerateAngleApi('set-1', 'A1', { hint: 'closer' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/angles/A1/regenerate',
        { hint: 'closer' },
      );
    });

    test('submitAngleReviewApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await submitAngleReviewApi('set-1', 'A1', { rating: 4 });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/angles/A1/review',
        { rating: 4 },
      );
    });

    test('updateAngleApi PATCH on /angles/:angleId', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
      await updateAngleApi('set-1', 'A1', { angle_label: 'tight' });
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/angles/A1',
        { angle_label: 'tight' },
      );
    });

    test('deleteAngleApi DELETE on /angles/:angleId', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteAngleApi('set-1', 'A1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/angles/A1');
    });

    test('deleteAllAnglesApi DELETE on bare /angles', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteAllAnglesApi('set-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/angles');
    });

    test('reorderAnglesApi PATCH (not POST) on /angles/reorder', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
      await reorderAnglesApi('set-1', { order: [{ id: 'A1', sort_order: 0 }] });
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/angles/reorder',
        { order: [{ id: 'A1', sort_order: 0 }] },
      );
    });

    test('generateAllAnglesApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await generateAllAnglesApi('set-1', { force: true });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/generate-all-angles',
        { force: true },
      );
    });
  });

  describe('AI / suggestions', () => {
    test('suggestAnglesApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await suggestAnglesApi('set-1', {});
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/suggest-angles',
        {},
      );
    });

    test('suggestAnglesFromImageApi POST with FormData', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      const formData = new FormData();
      formData.append('image', new Blob(['ref-jpg']));
      await suggestAnglesFromImageApi('set-1', formData);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/suggest-angles-from-image',
        formData,
      );
    });

    test('getAiCameraDirectionApi POST (not GET) with payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await getAiCameraDirectionApi('set-1', { mood: 'cinematic' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/ai-camera-direction',
        { mood: 'cinematic' },
      );
    });

    test('getMoodVariantsApi GET', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await getMoodVariantsApi('set-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/mood-variants');
    });

    test('generateMoodVariantsApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await generateMoodVariantsApi('set-1', { moods: ['warm'] });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/scene-sets/set-1/mood-variants',
        { moods: ['warm'] },
      );
    });

    test('getComparisonApi GET', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await getComparisonApi('set-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/comparison');
    });

    test('getWardrobeMatchApi GET', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await getWardrobeMatchApi('set-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/wardrobe-match');
    });
  });

  describe('Episode association', () => {
    test('listSceneSetEpisodesApi GET', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
      await listSceneSetEpisodesApi('set-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/episodes');
    });

    test('unlinkEpisodeFromSceneSetApi DELETE on /episodes/:episodeId', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await unlinkEpisodeFromSceneSetApi('set-1', 'ep-9');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/episodes/ep-9');
    });
  });

  describe('External (shows / episodes for picker)', () => {
    test('listShowsApi GET', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
      await listShowsApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/shows');
    });

    test('listEpisodesByShowApi GET with show_id query param + limit=100', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
      await listEpisodesByShowApi('show-7');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/episodes?show_id=show-7&limit=100',
      );
    });
  });

  describe('Error path propagation', () => {
    test('getSceneSetApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(getSceneSetApi('missing')).rejects.toThrow('not found');
    });

    test('createSceneSetApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('validation'));
      await expect(createSceneSetApi({})).rejects.toThrow('validation');
    });

    test('reorderAnglesApi rejection propagates', async () => {
      vi.mocked(apiClient.patch).mockRejectedValue(new Error('conflict'));
      await expect(reorderAnglesApi('set-1', { order: [] })).rejects.toThrow('conflict');
    });
  });
});
