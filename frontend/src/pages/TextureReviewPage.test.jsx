/**
 * TextureReviewPage — Track 6 CP9 behavioral tests (file 4 of 8).
 *
 * 5 fetch sites migrated via 3 module-scope helpers — getTextureLayerApi
 * covers 2 sites (initial load + post-regenerate refetch),
 * confirmTextureLayerApi covers 2 sites (single-layer + all variants).
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
  getTextureLayerApi,
  confirmTextureLayerApi,
  regenerateTextureLayerApi,
} from './TextureReviewPage';

describe('TextureReviewPage — Track 6 CP9 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getTextureLayerApi GET on /texture-layer/:char/:story', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { texture: {} } });
    await getTextureLayerApi('lala', '7');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/texture-layer/lala/7');
  });

  test('confirmTextureLayerApi POST single-layer (fields: array)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { texture: {} } });
    await confirmTextureLayerApi('7', { character_key: 'lala', fields: ['inner_thought_confirmed'] });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/texture-layer/confirm/7',
      { character_key: 'lala', fields: ['inner_thought_confirmed'] },
    );
  });

  test('confirmTextureLayerApi POST all-layers (fields: "all")', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { texture: {} } });
    await confirmTextureLayerApi('7', { character_key: 'lala', fields: 'all' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/texture-layer/confirm/7',
      { character_key: 'lala', fields: 'all' },
    );
  });

  test('regenerateTextureLayerApi POST on /texture-layer/regenerate/:story/:layer', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await regenerateTextureLayerApi('7', 'inner_thought', { character_key: 'lala' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/texture-layer/regenerate/7/inner_thought',
      { character_key: 'lala' },
    );
  });

  test('getTextureLayerApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
    await expect(getTextureLayerApi('x', '99')).rejects.toThrow('not found');
  });

  test('confirmTextureLayerApi rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
    await expect(confirmTextureLayerApi('7', {})).rejects.toThrow('forbidden');
  });

  test('regenerateTextureLayerApi rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('busy'));
    await expect(regenerateTextureLayerApi('7', 'x', {})).rejects.toThrow('busy');
  });
});
