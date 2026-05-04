/**
 * WorldStudio — Track 4 behavioral tests for CharacterFollowsTab helpers.
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
vi.mock('./RelationshipEngine', () => ({ default: () => null }));
vi.mock('./SocialProfileGenerator', () => ({ default: () => null }));

import apiClient from '../services/api';
import { fetchCharacterFollows, generateCharacterFollows } from './WorldStudio';

describe('WorldStudio — Track 4 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('fetchCharacterFollows GET /character-follows/:characterKey', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { profile: {} } });
    await fetchCharacterFollows('justawoman');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-follows/justawoman');
  });

  test('generateCharacterFollows POST /character-follows/generate/:characterKey', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await generateCharacterFollows('lala');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/character-follows/generate/lala');
  });

  test('error path — fetchCharacterFollows propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
    await expect(fetchCharacterFollows('x')).rejects.toThrow('not found');
  });
});
