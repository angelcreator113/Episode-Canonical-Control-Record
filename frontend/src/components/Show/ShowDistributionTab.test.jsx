/**
 * ShowDistributionTab — CP15.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import { getShowDistributionDefaultsApi, putShowDistributionDefaultsApi } from './ShowDistributionTab';

describe('ShowDistributionTab — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getShowDistributionDefaultsApi GET on /world/:show/distribution-defaults', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: {} } });
    await getShowDistributionDefaultsApi('s-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/s-1/distribution-defaults');
  });

  test('putShowDistributionDefaultsApi PUT with distribution_defaults wrapper', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    const defaults = { youtube: { enabled: true } };
    await putShowDistributionDefaultsApi('s-1', defaults);
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/world/s-1/distribution-defaults',
      { distribution_defaults: defaults },
    );
  });

  test('rejection propagates', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
    await expect(putShowDistributionDefaultsApi('s', {})).rejects.toThrow('forbidden');
  });
});
