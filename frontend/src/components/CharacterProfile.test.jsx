/**
 * CharacterProfile — Track 6 CP11 behavioral tests (file 10 of 17).
 *
 * 3 fetch sites migrated via 3 module-scope helpers — 3-of-3 sites
 * are file-local cross-CP duplicates of CP9 CharacterProfilePage
 * helpers per v2.12 §9.11. API_URL='/api/v1' default (config/api.js).
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
  getCharacterApi,
  getCharacterRelationshipsApi,
  getSocialProfileApi,
} from './CharacterProfile';

describe('CharacterProfile — Track 6 CP11 file-local helpers (CP9 dups)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getCharacterApi GET on /character-registry/characters/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { character: {} } });
    await getCharacterApi('lala');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/characters/lala');
  });

  test('getCharacterRelationshipsApi GET on /character-registry/characters/:id/relationships', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { relationships: [] } });
    await getCharacterRelationshipsApi('lala');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/character-registry/characters/lala/relationships',
    );
  });

  test('getSocialProfileApi GET on /social-profiles/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { profile: {} } });
    await getSocialProfileApi('feed-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/social-profiles/feed-1');
  });

  describe('Error path propagation', () => {
    test('getCharacterApi rejection propagates (caller surfaces "Character not found")', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(getCharacterApi('missing')).rejects.toThrow('not found');
    });

    test('getCharacterRelationshipsApi rejection propagates (caller catches → null)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('forbidden'));
      await expect(getCharacterRelationshipsApi('lala')).rejects.toThrow('forbidden');
    });

    test('getSocialProfileApi rejection propagates (caller catches → null)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(getSocialProfileApi('feed-1')).rejects.toThrow('not authorized');
    });
  });
});
