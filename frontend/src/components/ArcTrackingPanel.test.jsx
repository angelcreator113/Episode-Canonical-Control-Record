/**
 * ArcTrackingPanel — Track 6 CP8 behavioral tests (file 1 of 10).
 *
 * 1 fetch site migrated via 1 module-scope helper. Thenable .then().catch()
 * chain preserved.
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
import { getArcTrackingApi } from './ArcTrackingPanel';

describe('ArcTrackingPanel — Track 6 CP8 module-scope helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getArcTrackingApi GET on /arc-tracking/:characterKey', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { context: {} } });
    await getArcTrackingApi('lala');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/arc-tracking/lala');
  });

  test('getArcTrackingApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(getArcTrackingApi('x')).rejects.toThrow('not authorized');
  });
});
