/**
 * CharacterProfilePage — Track 6 CP9 behavioral tests (file 5 of 8).
 *
 * 5 fetch sites migrated via 5 module-scope helpers across 3 endpoint
 * families: /character-registry, /entanglements, /social-profiles. Includes
 * a 3-way Promise.all (load) + nested feed-profile fetch.
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
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import apiClient from '../services/api';
import {
  updateCharacterApi,
  getCharacterApi,
  getCharacterRelationshipsApi,
  getCharacterEntanglementsApi,
  getSocialProfileApi,
} from './CharacterProfilePage';

describe('CharacterProfilePage — Track 6 CP9 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('updateCharacterApi PUT on /character-registry/characters/:id', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await updateCharacterApi('c-1', { world: 'lalaverse' });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/character-registry/characters/c-1',
      { world: 'lalaverse' },
    );
  });

  test('getCharacterApi GET on /character-registry/characters/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { character: {} } });
    await getCharacterApi('c-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/characters/c-1');
  });

  test('getCharacterRelationshipsApi GET on /character-registry/characters/:id/relationships', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { relationships: [] } });
    await getCharacterRelationshipsApi('c-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/characters/c-1/relationships');
  });

  test('getCharacterEntanglementsApi GET on /entanglements/character/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { entanglements: [] } });
    await getCharacterEntanglementsApi('c-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/entanglements/character/c-1');
  });

  test('getSocialProfileApi GET on /social-profiles/:profileId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { profile: {} } });
    await getSocialProfileApi('p-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/social-profiles/p-1');
  });

  describe('Error path propagation', () => {
    test('updateCharacterApi rejection propagates', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
      await expect(updateCharacterApi('c-1', {})).rejects.toThrow('forbidden');
    });

    test('getCharacterApi rejection propagates (caller catch sets error message)', async () => {
      const httpErr = new Error('not found');
      httpErr.response = { status: 404, data: { error: 'Character not found' } };
      vi.mocked(apiClient.get).mockRejectedValue(httpErr);
      await expect(getCharacterApi('missing')).rejects.toMatchObject({
        response: { data: { error: 'Character not found' } },
      });
    });

    test('getCharacterRelationshipsApi rejection bubbles to Promise.all caller (.catch null)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('forbidden'));
      await expect(getCharacterRelationshipsApi('c-1')).rejects.toThrow('forbidden');
    });
  });
});
