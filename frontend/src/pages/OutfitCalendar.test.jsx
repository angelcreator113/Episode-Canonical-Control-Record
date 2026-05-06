/**
 * OutfitCalendar — CP15.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { listWardrobeApi, listOutfitSetsApi } from './OutfitCalendar';

describe('OutfitCalendar — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listWardrobeApi GET on /wardrobe?limit=', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await listWardrobeApi(1000);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/wardrobe?limit=1000');
  });

  test('listOutfitSetsApi GET on /outfit-sets', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await listOutfitSetsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/outfit-sets');
  });

  test('rejection propagates (caller leaves empty)', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listOutfitSetsApi()).rejects.toThrow('not authorized');
  });
});
