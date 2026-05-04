/**
 * SearchHistory — Track 4 behavioral tests.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../../services/api';
import { fetchSearchHistory, clearSearchHistory } from './SearchHistory';

describe('SearchHistory — Track 4 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('fetchSearchHistory GET with default limit=10', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await fetchSearchHistory();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/search/history?limit=10');
  });

  test('fetchSearchHistory GET with custom limit', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await fetchSearchHistory(50);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/search/history?limit=50');
  });

  test('clearSearchHistory DELETE', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await clearSearchHistory();
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/search/history');
  });

  test('error path — clearSearchHistory propagates', async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(new Error('forbidden'));
    await expect(clearSearchHistory()).rejects.toThrow('forbidden');
  });
});
