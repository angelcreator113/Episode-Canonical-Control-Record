/**
 * ChapterBrief — Track 6 CP8 behavioral tests (file 4 of 10).
 *
 * 1 fetch site migrated via updateChapterApi (file-local duplicate of CP3
 * WriteMode helper per v2.12 §9.11).
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
import { updateChapterApi } from './ChapterBrief';

describe('ChapterBrief — Track 6 CP8 module-scope helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('updateChapterApi PUT on /storyteller/chapters/:chapterId', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await updateChapterApi('ch-1', { theme: 'longing' });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/ch-1',
      { theme: 'longing' },
    );
  });

  test('updateChapterApi rejection propagates', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(new Error('not authorized'));
    await expect(updateChapterApi('ch-1', {})).rejects.toThrow('not authorized');
  });
});
