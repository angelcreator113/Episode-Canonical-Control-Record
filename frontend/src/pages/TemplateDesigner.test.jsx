/**
 * TemplateDesigner — Track 6 CP6 behavioral tests (file 4 of 4).
 *
 * 9 fetch sites migrated via 8 module-scope helpers across 4 endpoint
 * families: /episodes, /template-studio, /compositions, /thumbnail-templates.
 * createTemplateApi + updateTemplateApi split from handleSave's conditional
 * method-branching site (POST when no templateId, PUT when present).
 * Idiom: status === 'SUCCESS' uppercase envelope preserved verbatim.
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

vi.mock('react-konva', () => ({
  Stage: () => null,
  Layer: () => null,
  Rect: () => null,
  Text: () => null,
  Transformer: () => null,
  Image: () => null,
}));
vi.mock('use-image', () => ({ default: () => [null] }));
vi.mock('../constants/canonicalRoles', () => ({ CANONICAL_ROLES: [] }));

import apiClient from '../services/api';
import {
  listEpisodesApi,
  listEpisodeAssetsApi,
  getTemplateStudioApi,
  getCompositionApi,
  getThumbnailTemplateApi,
  createTemplateApi,
  updateTemplateApi,
  publishTemplateApi,
} from './TemplateDesigner';

describe('TemplateDesigner — Track 6 CP6 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Listings', () => {
    test('listEpisodesApi GET on /episodes?limit=50', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { status: 'SUCCESS', data: [] } });
      await listEpisodesApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes?limit=50');
    });

    test('listEpisodeAssetsApi GET on /episodes/:episodeId/assets', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { status: 'SUCCESS', data: [] } });
      await listEpisodeAssetsApi('ep-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/assets');
    });
  });

  describe('Template / composition GETs', () => {
    test('getTemplateStudioApi GET on /template-studio/:id (loadTemplate shape)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { status: 'SUCCESS', data: {} } });
      await getTemplateStudioApi('tpl-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/template-studio/tpl-1');
    });

    test('getTemplateStudioApi GET (loadTemplateStudioForComposition shape)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { status: 'SUCCESS', data: {} } });
      await getTemplateStudioApi('studio-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/template-studio/studio-1');
    });

    test('getCompositionApi GET on /compositions/:compositionId (loadComposition shape)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { status: 'SUCCESS', data: {} } });
      await getCompositionApi('comp-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/compositions/comp-1');
    });

    test('getCompositionApi GET (startPolling interval shape)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { status: 'SUCCESS', data: { outputs: [] } } });
      await getCompositionApi('comp-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/compositions/comp-1');
    });

    test('getThumbnailTemplateApi GET on /thumbnail-templates/:templateId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { status: 'SUCCESS', data: {} } });
      await getThumbnailTemplateApi('thumb-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/thumbnail-templates/thumb-1');
    });
  });

  describe('Template save (handleSave method-branching split)', () => {
    test('createTemplateApi POST on /template-studio when no templateId', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'new-tpl' } } });
      const payload = { name: 'My Template', description: '', canvas_config: {}, role_slots: [] };
      await createTemplateApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/template-studio', payload);
    });

    test('updateTemplateApi PUT on /template-studio/:templateId when templateId exists', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: { data: { id: 'tpl-1' } } });
      const payload = { name: 'Updated', description: '', canvas_config: {}, role_slots: [] };
      await updateTemplateApi('tpl-1', payload);
      expect(apiClient.put).toHaveBeenCalledWith('/api/v1/template-studio/tpl-1', payload);
    });

    test('publishTemplateApi POST on /template-studio/:templateId/publish (no body)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await publishTemplateApi('tpl-1');
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/template-studio/tpl-1/publish');
    });
  });

  describe('Error path propagation', () => {
    test('listEpisodesApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listEpisodesApi()).rejects.toThrow('not authorized');
    });

    test('createTemplateApi exposes response.data.message for save UX', async () => {
      const httpErr = new Error('validation');
      httpErr.response = { status: 400, data: { message: 'name required' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(createTemplateApi({})).rejects.toMatchObject({
        response: { data: { message: 'name required' } },
      });
    });

    test('publishTemplateApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('publish denied'));
      await expect(publishTemplateApi('tpl-1')).rejects.toThrow('publish denied');
    });
  });
});
