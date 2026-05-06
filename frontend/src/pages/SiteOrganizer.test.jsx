/**
 * SiteOrganizer — Track 6 CP11 behavioral tests (file 3 of 17).
 *
 * 3 fetch sites migrated via 3 module-scope helpers. No cross-CP
 * duplication; admin-tooling family.
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
  getSiteOrganizerQuickApi,
  runSiteOrganizerScanApi,
  runSiteOrganizerAgentApi,
} from './SiteOrganizer';

describe('SiteOrganizer — Track 6 CP11 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getSiteOrganizerQuickApi GET on /site-organizer/quick', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { routes: 12 } });
    const out = await getSiteOrganizerQuickApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/site-organizer/quick');
    expect(out).toEqual({ routes: 12 });
  });

  test('runSiteOrganizerScanApi GET on /site-organizer/scan', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { overall_score: 80 } });
    const out = await runSiteOrganizerScanApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/site-organizer/scan');
    expect(out).toEqual({ overall_score: 80 });
  });

  test('runSiteOrganizerAgentApi GET on /site-organizer/agent/:name', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { score: 90 } });
    await runSiteOrganizerAgentApi('navigation_auditor');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/site-organizer/agent/navigation_auditor');
  });

  describe('Error path propagation', () => {
    test('getSiteOrganizerQuickApi rejection propagates (caller swallows)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(getSiteOrganizerQuickApi()).rejects.toThrow('not authorized');
    });

    test('runSiteOrganizerScanApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('scan failed'));
      await expect(runSiteOrganizerScanApi()).rejects.toThrow('scan failed');
    });

    test('runSiteOrganizerAgentApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('agent failed'));
      await expect(runSiteOrganizerAgentApi('flow_analyzer')).rejects.toThrow('agent failed');
    });
  });
});
