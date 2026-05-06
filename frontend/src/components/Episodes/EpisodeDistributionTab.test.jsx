/**
 * EpisodeDistributionTab — Track 6 CP11 behavioral tests (file 13 of 17).
 *
 * 3 fetch sites migrated via 3 fresh helpers (no cross-CP overlap).
 * Per-platform publishing metadata family.
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
import {
  getEpisodeDistributionApi,
  putEpisodeDistributionApi,
  generateEpisodeDistributionApi,
} from './EpisodeDistributionTab';

describe('EpisodeDistributionTab — Track 6 CP11 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getEpisodeDistributionApi GET on /world/:showId/episodes/:id/distribution', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: {} } });
    await getEpisodeDistributionApi('s-1', 'ep-1');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/world/s-1/episodes/ep-1/distribution',
    );
  });

  test('putEpisodeDistributionApi PUT on …/distribution with distribution_metadata wrapper', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    const meta = { youtube: { enabled: true } };
    await putEpisodeDistributionApi('s-1', 'ep-1', meta);
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/world/s-1/episodes/ep-1/distribution',
      { distribution_metadata: meta },
    );
  });

  test('generateEpisodeDistributionApi POST on …/generate-distribution returns response.data', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { success: true, data: { platforms: { youtube: {} } } },
    });
    const out = await generateEpisodeDistributionApi('s-1', 'ep-1', {});
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/world/s-1/episodes/ep-1/generate-distribution',
      {},
    );
    expect(out.success).toBe(true);
  });

  describe('Error path propagation', () => {
    test('getEpisodeDistributionApi rejection propagates (caller falls through to defaults)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(getEpisodeDistributionApi('s', 'ep')).rejects.toThrow('not found');
    });

    test('putEpisodeDistributionApi rejection propagates (caller falls back to onUpdate)', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
      await expect(putEpisodeDistributionApi('s', 'ep', {})).rejects.toThrow('forbidden');
    });

    test('generateEpisodeDistributionApi rejection propagates (caller alerts)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('rate limited'));
      await expect(generateEpisodeDistributionApi('s', 'ep', {})).rejects.toThrow('rate limited');
    });
  });
});
