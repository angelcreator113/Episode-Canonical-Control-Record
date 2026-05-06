/**
 * EpisodeScriptTab — CP15 (5th partial-migration extension).
 * listLocationsApi: 3-fold cross-CP (CP8 + CP11 + CP15 here).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import { listLocationsApi, getWorldMapApi } from './EpisodeScriptTab';

describe('EpisodeScriptTab — Track 6 CP15 partial-migration extension', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('listLocationsApi GET on /world/locations (3-fold cross-CP)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { locations: [] } });
    await listLocationsApi();
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/locations');
  });

  test('getWorldMapApi GET on /world/map', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { url: 'https://...' } });
    await getWorldMapApi();
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/map');
  });

  test('rejection propagates (caller swallows)', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('not authorized'));
    await expect(listLocationsApi()).rejects.toThrow('not authorized');
  });
});
