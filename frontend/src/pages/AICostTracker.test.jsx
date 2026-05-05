/**
 * AICostTracker — Track 6 CP7 behavioral tests (file 6 of 10).
 *
 * 6 fetch sites migrated via 6 module-scope helpers on /ai-usage/*. Pure
 * thenable shape collapsed: apiClient Promise.all returns parsed res.data,
 * pre-migration .json() chain is no longer needed.
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
  getSummaryApi,
  getByModelApi,
  getByRouteApi,
  getDailyApi,
  getOptimizationsApi,
  getRecentApi,
} from './AICostTracker';

describe('AICostTracker — Track 6 CP7 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getSummaryApi GET on /ai-usage/summary?days=...', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await getSummaryApi(30);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/ai-usage/summary?days=30');
  });

  test('getByModelApi GET on /ai-usage/by-model?days=...', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await getByModelApi(7);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/ai-usage/by-model?days=7');
  });

  test('getByRouteApi GET on /ai-usage/by-route?days=...', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await getByRouteApi(30);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/ai-usage/by-route?days=30');
  });

  test('getDailyApi GET on /ai-usage/daily?days=...', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await getDailyApi(90);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/ai-usage/daily?days=90');
  });

  test('getOptimizationsApi GET on /ai-usage/optimizations', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await getOptimizationsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/ai-usage/optimizations');
  });

  test('getRecentApi GET on /ai-usage/recent?limit=...', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await getRecentApi(100);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/ai-usage/recent?limit=100');
  });

  test('getSummaryApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(getSummaryApi(30)).rejects.toThrow('not authorized');
  });

  test('getRecentApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('forbidden'));
    await expect(getRecentApi(100)).rejects.toThrow('forbidden');
  });
});
