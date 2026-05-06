/**
 * FeedEnhancements — CP15 (generateMemoriesAiApi).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import { generateMemoriesAiApi } from './FeedEnhancements';

describe('FeedEnhancements — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('generateMemoriesAiApi POST on /memories/ai with prompt+maxTokens payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { response: '...' } });
    const payload = { prompt: 'reaction prompt', maxTokens: 1500 };
    await generateMemoriesAiApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/memories/ai', payload);
  });

  test('rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('rate limit'));
    await expect(generateMemoriesAiApi({})).rejects.toThrow('rate limit');
  });
});
