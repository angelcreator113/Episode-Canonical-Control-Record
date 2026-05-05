/**
 * CharacterGenerator — Track 6 CP6 behavioral tests (file 1 of 4 in CP6 batch).
 *
 * 10 fetch sites migrated via 8 module-scope helpers covering /world/*,
 * /character-generator/*, and /character-registry/* (single DELETE).
 * MEDIUM-HIGH cost class — nested Promise.all in handleGenerateBatch +
 * handleProposeSeeds, manual commit loop in handleCommitAll, inline
 * anonymous onClick at line 312 extracted to module-scope helper.
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

vi.mock('../hooks/useRegistries', () => ({ default: () => ({ registries: [] }) }));
vi.mock('../constants/characterConstants', () => ({
  ROLE_COLORS: {},
  ROLE_ICONS: {},
  MOMENTUM_COLORS: {},
  WORLD_LABELS: {},
}));

import apiClient from '../services/api';
import {
  generateEcosystemApi,
  getEcosystemApi,
  proposeSeedsApi,
  generateBatchApi,
  checkStagingApi,
  commitCharacterApi,
  rewriteFieldApi,
  deleteRegistryCharacterApi,
} from './CharacterGenerator';

describe('CharacterGenerator — Track 6 CP6 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('World / ecosystem', () => {
    test('generateEcosystemApi POST on /world/generate-ecosystem', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { characters: [], count: 8 } });
      const payload = {
        world_context: { city: 'NYC', industry: 'tech', career_stage: 'mid' },
        character_count: 8,
      };
      await generateEcosystemApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/world/generate-ecosystem',
        payload,
      );
    });

    test('getEcosystemApi GET on /character-generator/ecosystem', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { book1: { stats: {} } } });
      await getEcosystemApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-generator/ecosystem');
    });
  });

  describe('Generation pipeline', () => {
    test('proposeSeedsApi POST on /character-generator/propose-seeds', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { seeds: [] } });
      const payload = { world: 'book1', count: 5, existing_names: [], ecosystem_stats: {} };
      await proposeSeedsApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/character-generator/propose-seeds',
        payload,
      );
    });

    test('generateBatchApi POST on /character-generator/generate-batch (handleGenerateBatch shape)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { batch: [] } });
      await generateBatchApi({ seeds: [{ name: 'Lala' }], existingCharacters: [] });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/character-generator/generate-batch',
        { seeds: [{ name: 'Lala' }], existingCharacters: [] },
      );
    });

    test('generateBatchApi POST with single seed (handleRegenerate shape)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { batch: [{ status: 'generated' }] } });
      await generateBatchApi({ seeds: [{ name: 'X' }], existingCharacters: [] });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/character-generator/generate-batch',
        { seeds: [{ name: 'X' }], existingCharacters: [] },
      );
    });

    test('checkStagingApi POST on /character-generator/check-staging', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { duplicates: [], conflicts: [] } });
      await checkStagingApi({ character: {}, existingCharacters: [], ecosystemStats: {} });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/character-generator/check-staging',
        { character: {}, existingCharacters: [], ecosystemStats: {} },
      );
    });

    test('commitCharacterApi POST on /character-generator/commit', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { character_id: 'c-1' } });
      await commitCharacterApi({ profile: {}, seed: {}, registryId: 'reg-1' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/character-generator/commit',
        { profile: {}, seed: {}, registryId: 'reg-1' },
      );
    });

    test('rewriteFieldApi POST on /character-generator/rewrite-field', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { newValue: 'rewritten' } });
      await rewriteFieldApi({ fieldPath: 'profile.bio', currentValue: 'old', characterContext: {} });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/character-generator/rewrite-field',
        { fieldPath: 'profile.bio', currentValue: 'old', characterContext: {} },
      );
    });
  });

  describe('Character registry deletion', () => {
    test('deleteRegistryCharacterApi DELETE on /character-registry/characters/:charId', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteRegistryCharacterApi('c-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/character-registry/characters/c-1');
    });
  });

  describe('Error path propagation', () => {
    test('generateEcosystemApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not authorized'));
      await expect(generateEcosystemApi({})).rejects.toThrow('not authorized');
    });

    test('commitCharacterApi exposes response.data.error for alert UX', async () => {
      const httpErr = new Error('conflict');
      httpErr.response = { status: 409, data: { error: 'duplicate name' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(commitCharacterApi({})).rejects.toMatchObject({
        response: { data: { error: 'duplicate name' } },
      });
    });

    test('deleteRegistryCharacterApi rejection propagates', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('forbidden'));
      await expect(deleteRegistryCharacterApi('c-1')).rejects.toThrow('forbidden');
    });
  });
});
