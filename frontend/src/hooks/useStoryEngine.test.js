/**
 * useStoryEngine — Track 3 behavioral tests for migrated apiClient helpers.
 *
 * Covers persistStory + deleteStoryFromDb. The pre-flight noted that the
 * previous local authHeaders(extra={}) supported header merging, but no
 * caller actually passed an extra object — drift confirmed dead, dropped
 * cleanly during migration.
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
import { persistStory, deleteStoryFromDb } from './useStoryEngine';

describe('useStoryEngine — Track 3 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('persistStory calls apiClient.post with /stories + payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { story: { id: 'st-1' } } });
    const payload = {
      character_key: 'justawoman',
      story_number: 7,
      title: 'A Story',
      text: 'Once upon...',
      status: 'draft',
    };
    const r = await persistStory(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/stories', payload);
    expect(r.data.story.id).toBe('st-1');
  });

  test('deleteStoryFromDb calls apiClient.delete on /stories/:dbId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteStoryFromDb('db-99');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/stories/db-99');
  });

  test('error path — persistStory propagates rejection', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('500'));
    await expect(persistStory({})).rejects.toThrow('500');
  });
});
