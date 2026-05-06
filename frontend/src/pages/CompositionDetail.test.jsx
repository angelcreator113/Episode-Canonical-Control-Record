/**
 * CompositionDetail — Track 6 CP10 behavioral tests (file 4 of 8).
 *
 * 6 fetch sites migrated via 5 module-scope helpers — generateOutputsApi
 * covers 2 sites (handleRegenerateOutput single-format + handleRetryFailed
 * multi-format, same endpoint different payloads). getCompositionApi
 * duplicated locally per v2.12 §9.11 (CP6 TemplateDesigner has it).
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

vi.mock('../components/LayoutEditor', () => ({ default: () => null }));

import apiClient from '../services/api';
import {
  getCompositionApi,
  listCompositionOutputsApi,
  deleteOutputApi,
  generateOutputsApi,
  setPrimaryCompositionApi,
} from './CompositionDetail';

describe('CompositionDetail — Track 6 CP10 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getCompositionApi GET on /compositions/:id (CP6 dup)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: {} } });
    await getCompositionApi('c-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/compositions/c-1');
  });

  test('listCompositionOutputsApi GET on /compositions/:id/outputs', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await listCompositionOutputsApi('c-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/compositions/c-1/outputs');
  });

  test('deleteOutputApi DELETE on /outputs/:outputId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteOutputApi('o-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/outputs/o-1');
  });

  test('generateOutputsApi POST single-format (handleRegenerateOutput shape)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await generateOutputsApi('c-1', { formats: ['YOUTUBE'], regenerate: true });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/compositions/c-1/outputs/generate',
      { formats: ['YOUTUBE'], regenerate: true },
    );
  });

  test('generateOutputsApi POST multi-format (handleRetryFailed shape)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await generateOutputsApi('c-1', { formats: ['YOUTUBE', 'INSTAGRAM_FEED', 'TWITTER'], regenerate: true });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/compositions/c-1/outputs/generate',
      { formats: ['YOUTUBE', 'INSTAGRAM_FEED', 'TWITTER'], regenerate: true },
    );
  });

  test('setPrimaryCompositionApi PUT on /compositions/:id/primary (no body)', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { data: {} } });
    await setPrimaryCompositionApi('c-1');
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/compositions/c-1/primary');
  });

  describe('Error path propagation', () => {
    test('getCompositionApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(getCompositionApi('missing')).rejects.toThrow('not found');
    });

    test('deleteOutputApi exposes response.data.error for alert UX', async () => {
      const httpErr = new Error('forbidden');
      httpErr.response = { status: 403, data: { error: 'no permission' } };
      vi.mocked(apiClient.delete).mockRejectedValue(httpErr);
      await expect(deleteOutputApi('o-1')).rejects.toMatchObject({
        response: { data: { error: 'no permission' } },
      });
    });

    test('setPrimaryCompositionApi rejection propagates', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('conflict'));
      await expect(setPrimaryCompositionApi('c-1')).rejects.toThrow('conflict');
    });
  });
});
