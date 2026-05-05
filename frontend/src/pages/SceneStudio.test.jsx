/**
 * SceneStudio — Track 6 CP8 behavioral tests (file 6 of 10).
 *
 * 6 fetch sites migrated via 6 module-scope helpers on /world/* (characters,
 * scenes listing with optional ?status=, tension-check, scene-generate,
 * approve, delete). All clean — no cross-CP overlaps.
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
  listCharactersApi,
  listScenesApi,
  getTensionCheckApi,
  generateSceneApi,
  approveSceneApi,
  deleteSceneApi,
} from './SceneStudio';

describe('SceneStudio — Track 6 CP8 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listCharactersApi GET on /world/characters', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { characters: [] } });
    await listCharactersApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/characters');
  });

  test('listScenesApi GET on /world/scenes (no status filter)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { scenes: [] } });
    await listScenesApi('all');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/scenes');
  });

  test('listScenesApi GET with status filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { scenes: [] } });
    await listScenesApi('approved');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/scenes?status=approved');
  });

  test('getTensionCheckApi GET on /world/tension-check', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { pairs: [] } });
    await getTensionCheckApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/tension-check');
  });

  test('generateSceneApi POST on /world/scenes/generate', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { scene: {} } });
    const payload = { character_a_id: 'a', character_b_id: 'b', scene_type: 'hook_up', location: undefined };
    await generateSceneApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/scenes/generate', payload);
  });

  test('approveSceneApi POST on /world/scenes/:sceneId/approve (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { scene: {} } });
    await approveSceneApi('sc-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/scenes/sc-1/approve');
  });

  test('deleteSceneApi DELETE on /world/scenes/:sceneId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteSceneApi('sc-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/world/scenes/sc-1');
  });

  test('listCharactersApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listCharactersApi()).rejects.toThrow('not authorized');
  });

  test('generateSceneApi rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('busy'));
    await expect(generateSceneApi({})).rejects.toThrow('busy');
  });
});
