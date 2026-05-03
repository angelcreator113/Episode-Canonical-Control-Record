/**
 * EpisodeReview — Track 3 behavioral tests for migrated apiClient helpers.
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
  fetchEpisodeForReview,
  fetchUnacknowledgedReviews,
  acknowledgeReview,
  requestPostGenerationReview,
} from './EpisodeReview';

describe('EpisodeReview — Track 3 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('fetchEpisodeForReview calls apiClient.get on /episodes/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 'ep-1' } });
    await fetchEpisodeForReview('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1');
  });

  test('fetchUnacknowledgedReviews calls apiClient.get on /reviews/unacknowledged', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await fetchUnacknowledgedReviews();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reviews/unacknowledged');
  });

  test('acknowledgeReview calls apiClient.post on /reviews/:id/acknowledge', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await acknowledgeReview('rev-7');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/reviews/rev-7/acknowledge');
  });

  test('requestPostGenerationReview calls apiClient.post with scene_id payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await requestPostGenerationReview('sc-5');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/reviews/post-generation',
      { scene_id: 'sc-5' }
    );
  });

  test('error path — acknowledgeReview rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('not found'));
    await expect(acknowledgeReview('rev-x')).rejects.toThrow('not found');
  });
});
