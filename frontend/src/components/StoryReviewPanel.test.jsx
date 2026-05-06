/**
 * StoryReviewPanel — Track 6 CP11 behavioral tests (file 14 of 17).
 *
 * 3 fetch sites migrated via 3 helpers. listStoriesForCharacterApi
 * is a CP9 cross-CP duplicate per v2.12 §9.11; the other two are
 * fresh. The pre-existing apiClient.post on /stories (line 81)
 * pre-dates this file — already migrated in earlier work.
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
  listStoriesForCharacterApi,
  approveStoryApi,
  rejectStoryApi,
} from './StoryReviewPanel';

describe('StoryReviewPanel — Track 6 CP11 file-local helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listStoriesForCharacterApi GET on /stories/character/:key (CP9 dup)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { stories: [] } });
    await listStoriesForCharacterApi('justawoman');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/stories/character/justawoman');
  });

  test('approveStoryApi POST on /stories/:id/approve (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { story: {} } });
    await approveStoryApi('s-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/stories/s-1/approve');
  });

  test('rejectStoryApi PATCH on /stories/:id with status=rejected', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    await rejectStoryApi('s-1');
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/stories/s-1',
      { status: 'rejected' },
    );
  });

  describe('Error path propagation', () => {
    test('listStoriesForCharacterApi rejection propagates (caller swallows)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listStoriesForCharacterApi('x')).rejects.toThrow('not authorized');
    });

    test('approveStoryApi rejection propagates (caller logs)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
      await expect(approveStoryApi('s-1')).rejects.toThrow('forbidden');
    });

    test('rejectStoryApi rejection propagates (caller swallows)', async () => {
      vi.mocked(apiClient.patch).mockRejectedValue(new Error('not found'));
      await expect(rejectStoryApi('missing')).rejects.toThrow('not found');
    });
  });
});
