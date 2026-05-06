/**
 * DesignAgent — CP15 (admin-tooling family, similar to CP11 SiteOrganizer).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { runDesignAgentScanApi, runDesignAgentApi } from './DesignAgent';

describe('DesignAgent — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('runDesignAgentScanApi GET on /design-agent/scan', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await runDesignAgentScanApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/design-agent/scan');
  });

  test('runDesignAgentApi GET on /design-agent/agent/:name (URI-encoded)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await runDesignAgentApi('responsive auditor');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/design-agent/agent/responsive%20auditor');
  });

  test('rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('failed'));
    await expect(runDesignAgentScanApi()).rejects.toThrow('failed');
  });
});
