/**
 * DreamMap — CP15 (city-positions persistence).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { getMapPositionsApi, saveMapPositionsApi } from './DreamMap';

describe('DreamMap — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getMapPositionsApi GET on /world/map/positions', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { positions: {} } });
    await getMapPositionsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/map/positions');
  });

  test('saveMapPositionsApi PUT on /world/map/positions with positions wrapper', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    const positions = { miami: { x: 100, y: 200 } };
    await saveMapPositionsApi(positions);
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/world/map/positions', { positions });
  });

  test('rejection propagates', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
    await expect(saveMapPositionsApi({})).rejects.toThrow('forbidden');
  });
});
