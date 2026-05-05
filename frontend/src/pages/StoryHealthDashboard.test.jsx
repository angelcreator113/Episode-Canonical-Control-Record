/**
 * StoryHealthDashboard — Track 6 CP7 behavioral tests (file 3 of 10).
 *
 * 1 fetch site migrated via 1 module-scope helper. Thenable .then() chain
 * preserved; .catch(() => {}) silent fallback retained.
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
import { getStoryHealthDashboardApi } from './StoryHealthDashboard';

describe('StoryHealthDashboard — Track 6 CP7 module-scope helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getStoryHealthDashboardApi GET on /story-health/dashboard', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { stories: {}, threads: {}, evaluation: {} } });
    await getStoryHealthDashboardApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/story-health/dashboard');
  });

  test('getStoryHealthDashboardApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(getStoryHealthDashboardApi()).rejects.toThrow('not authorized');
  });
});
