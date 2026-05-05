/**
 * NovelAssembler — Track 6 CP8 behavioral tests (file 7 of 10).
 *
 * 6 fetch sites migrated via 6 module-scope helpers on /stories/*. Promise.all
 * + `if (res.ok)` collapsed via apiClient interceptor.
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
  listCharacterStoriesApi,
  listCharacterAssembliesApi,
  listCharacterSocialApi,
  createAssemblyApi,
  compileAssemblyApi,
  deleteAssemblyApi,
} from './NovelAssembler';

describe('NovelAssembler — Track 6 CP8 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listCharacterStoriesApi GET on /stories/character/:charKey', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { stories: [] } });
    await listCharacterStoriesApi('justawoman');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/stories/character/justawoman');
  });

  test('listCharacterAssembliesApi GET on /stories/assemblies/character/:charKey', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { assemblies: [] } });
    await listCharacterAssembliesApi('justawoman');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/stories/assemblies/character/justawoman');
  });

  test('listCharacterSocialApi GET on /stories/social/character/:charKey', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { imports: [] } });
    await listCharacterSocialApi('justawoman');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/stories/social/character/justawoman');
  });

  test('createAssemblyApi POST on /stories/assemblies', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const payload = { title: 'Book 1 alt cut', character_key: 'justawoman', story_ids: ['s1', 's2'] };
    await createAssemblyApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/stories/assemblies', payload);
  });

  test('compileAssemblyApi POST on /stories/assemblies/:id/compile (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { assembly: {} } });
    await compileAssemblyApi('a-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/stories/assemblies/a-1/compile');
  });

  test('deleteAssemblyApi DELETE on /stories/assemblies/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteAssemblyApi('a-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/stories/assemblies/a-1');
  });

  test('listCharacterStoriesApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listCharacterStoriesApi('x')).rejects.toThrow('not authorized');
  });

  test('createAssemblyApi rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('validation'));
    await expect(createAssemblyApi({})).rejects.toThrow('validation');
  });
});
