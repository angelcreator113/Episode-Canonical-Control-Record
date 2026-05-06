/**
 * CharacterDepthPanel — Track 6 CP10 behavioral tests (file 1 of 8).
 *
 * 4 fetch sites migrated via 4 module-scope helpers on /character-depth/*.
 * Clean cluster — no cross-CP duplications. (WorldStudio.jsx hits the same
 * endpoints but is in the deferred Path E cluster; its helpers don't exist
 * yet.)
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

vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));

import apiClient from '../services/api';
import {
  getCharacterDepthApi,
  generateDepthDimensionApi,
  generateAllDepthApi,
  confirmDepthApi,
} from './CharacterDepthPanel';

describe('CharacterDepthPanel — Track 6 CP10 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getCharacterDepthApi GET on /character-depth/:characterId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { depth: {} } });
    await getCharacterDepthApi('c-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-depth/c-1');
  });

  test('generateDepthDimensionApi POST on /character-depth/:characterId/generate/:dimension (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { proposed: {} } });
    await generateDepthDimensionApi('c-1', 'body');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/character-depth/c-1/generate/body');
  });

  test('generateAllDepthApi POST on /character-depth/:characterId/generate (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { proposed: {} } });
    await generateAllDepthApi('c-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/character-depth/c-1/generate');
  });

  test('confirmDepthApi POST on /character-depth/:characterId/confirm with proposed payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { depth: {} } });
    const payload = { proposed: { body: 'tall' } };
    await confirmDepthApi('c-1', payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/character-depth/c-1/confirm',
      payload,
    );
  });

  describe('Error path propagation', () => {
    test('getCharacterDepthApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(getCharacterDepthApi('missing')).rejects.toThrow('not found');
    });

    test('generateDepthDimensionApi exposes response.data.error for UX', async () => {
      const httpErr = new Error('rate limited');
      httpErr.response = { status: 429, data: { error: 'busy' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(generateDepthDimensionApi('c-1', 'body')).rejects.toMatchObject({
        response: { data: { error: 'busy' } },
      });
    });

    test('confirmDepthApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
      await expect(confirmDepthApi('c-1', {})).rejects.toThrow('forbidden');
    });
  });
});
