/**
 * AmberCommandCenter — Track 6 CP7 behavioral tests (file 8 of 10).
 *
 * 6 fetch sites migrated via 6 module-scope helpers on /api/v1/amber/diagnostic/*.
 * `if (!res.ok) throw new Error((await res.json()).error)` collapsed —
 * apiClient throws and call sites read err.response?.data?.error for UX.
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
  listFindingsApi,
  getQueueApi,
  triggerScanApi,
  approveFindingApi,
  executeFindingApi,
  dismissFindingApi,
} from './AmberCommandCenter';

describe('AmberCommandCenter — Track 6 CP7 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listFindingsApi GET without query string', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await listFindingsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/amber/diagnostic/findings');
  });

  test('listFindingsApi GET with status query string', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await listFindingsApi('status=detected,surfaced,approved,executing');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/amber/diagnostic/findings?status=detected,surfaced,approved,executing',
    );
  });

  test('getQueueApi GET on /amber/diagnostic/queue', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await getQueueApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/amber/diagnostic/queue');
  });

  test('triggerScanApi POST on /amber/diagnostic/scan', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { detected: 0 } });
    await triggerScanApi({ trigger: 'manual' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/amber/diagnostic/scan',
      { trigger: 'manual' },
    );
  });

  test('approveFindingApi POST on /findings/:id/approve (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await approveFindingApi('f-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/amber/diagnostic/findings/f-1/approve');
  });

  test('executeFindingApi POST on /findings/:id/execute (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await executeFindingApi('f-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/amber/diagnostic/findings/f-1/execute');
  });

  test('dismissFindingApi POST on /findings/:id/dismiss (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await dismissFindingApi('f-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/amber/diagnostic/findings/f-1/dismiss');
  });

  test('approveFindingApi exposes response.data.error for toast UX', async () => {
    const httpErr = new Error('conflict');
    httpErr.response = { status: 409, data: { error: 'already approved' } };
    vi.mocked(apiClient.post).mockRejectedValue(httpErr);
    await expect(approveFindingApi('f-1')).rejects.toMatchObject({
      response: { data: { error: 'already approved' } },
    });
  });

  test('triggerScanApi rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('busy'));
    await expect(triggerScanApi({})).rejects.toThrow('busy');
  });
});
