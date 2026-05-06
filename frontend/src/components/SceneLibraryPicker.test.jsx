/**
 * SceneLibraryPicker — CP15.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { getEpisodeApi } from './SceneLibraryPicker';

describe('SceneLibraryPicker — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getEpisodeApi GET on /episodes/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { show_id: 's-1' } } });
    await getEpisodeApi('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1');
  });

  test('rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
    await expect(getEpisodeApi('missing')).rejects.toThrow('not found');
  });
});
