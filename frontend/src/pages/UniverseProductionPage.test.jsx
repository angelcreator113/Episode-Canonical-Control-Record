/**
 * UniverseProductionPage — CP15 (listShowsApi 5-fold cross-CP).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { listShowsApi } from './UniverseProductionPage';

describe('UniverseProductionPage — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listShowsApi GET on /shows (5-fold cross-CP)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await listShowsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/shows');
  });

  test('rejection propagates (caller falls back to empty array)', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listShowsApi()).rejects.toThrow('not authorized');
  });
});
