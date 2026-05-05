/**
 * CFOAgent — Track 6 CP7 behavioral tests (file 9 of 10).
 *
 * 8 fetch sites migrated via 7 module-scope helpers on /cfo/* — getQuickStatsApi
 * is reused at 2 sites (initial mount + post-budget-save refresh). Mixed
 * idiom: thenable for fire-and-forget GETs, async for state-bearing handlers.
 * setBudgetApi is PUT (not POST per backend contract).
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
  getQuickStatsApi,
  getSchedulerApi,
  getAuditApi,
  getAgentApi,
  triggerSchedulerActionApi,
  getHistoryApi,
  setBudgetApi,
} from './CFOAgent';

describe('CFOAgent — Track 6 CP7 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getQuickStatsApi GET on /cfo/quick', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { today_cost: 0 } });
    await getQuickStatsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/cfo/quick');
  });

  test('getSchedulerApi GET on /cfo/scheduler', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { running: false } });
    await getSchedulerApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/cfo/scheduler');
  });

  test('getAuditApi GET on /cfo/audit', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await getAuditApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/cfo/audit');
  });

  test('getAgentApi GET on /cfo/agent/:name', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await getAgentApi('cost-watchdog');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/cfo/agent/cost-watchdog');
  });

  test('triggerSchedulerActionApi POST on /cfo/scheduler/:action with payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { running: true } });
    await triggerSchedulerActionApi('start', { interval_hours: 6 });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/cfo/scheduler/start',
      { interval_hours: 6 },
    );
  });

  test('triggerSchedulerActionApi handles stop action', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { running: false } });
    await triggerSchedulerActionApi('stop', { interval_hours: 6 });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/cfo/scheduler/stop',
      { interval_hours: 6 },
    );
  });

  test('getHistoryApi GET on /cfo/history', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await getHistoryApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/cfo/history');
  });

  test('setBudgetApi PUT (not POST) on /cfo/budget', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    const payload = { daily_limit: 5, monthly_limit: 100, warn_pct: 80 };
    await setBudgetApi(payload);
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/cfo/budget', payload);
  });

  test('getAuditApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(getAuditApi()).rejects.toThrow('not authorized');
  });

  test('setBudgetApi rejection propagates', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(new Error('validation'));
    await expect(setBudgetApi({})).rejects.toThrow('validation');
  });
});
