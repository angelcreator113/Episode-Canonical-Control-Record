/**
 * CommandPalette — Track 6 CP7 behavioral tests (file 4 of 10).
 *
 * 1 fetch site migrated via 1 module-scope helper. Query string built with
 * encodeURIComponent inside the helper.
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
import { searchStoryHealthApi } from './CommandPalette';

describe('CommandPalette — Track 6 CP7 module-scope helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('searchStoryHealthApi GET on /story-health/search?q=...', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { results: [] } });
    await searchStoryHealthApi('lala');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/story-health/search?q=lala');
  });

  test('searchStoryHealthApi encodes special characters', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { results: [] } });
    await searchStoryHealthApi('echo park');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/story-health/search?q=echo%20park');
  });

  test('searchStoryHealthApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(searchStoryHealthApi('x')).rejects.toThrow('not authorized');
  });
});
