/**
 * WorldSetupGuide — Track 6 CP15 ANCHOR (final CP).
 *
 * 8 sites all-BUG (UNCLEAR-B reclassified per v2.22 §9.11 — provisional
 * "mixed PUBLIC+BUG" label superseded by cross-CP evidence; every
 * endpoint is auth-required via apiClient elsewhere).
 *
 * 6 helpers cover 8 sites with 3-way reuse on getPageContentApi (sites
 * 1, 2, 4 — second helper-reuse-density data point after CP14 EpisodeDetail).
 *
 * Cross-CP duplications per v2.12 §9.11:
 *   - listShowsApi: 6-fold (meets v2.17 §9.11 ceiling)
 *   - listLocationsApi: 4-fold
 *   - listWorldEventsApi: 4-fold
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import {
  getPageContentApi,
  listCalendarEventsApi,
  listLocationsApi,
  listSocialProfilesApi,
  listShowsApi,
  listWorldEventsApi,
} from './WorldSetupGuide';

describe('WorldSetupGuide — Track 6 CP15 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  // ── 6 helpers covering 8 sites (3-way reuse on getPageContentApi) ───────

  test('getPageContentApi GET on /page-content/:name (3× reuse)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: {} } });
    await getPageContentApi('world_infrastructure');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/page-content/world_infrastructure');
  });

  test('listCalendarEventsApi GET with event_type query (encoded)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    await listCalendarEventsApi('lalaverse_cultural');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/calendar/events?event_type=lalaverse_cultural',
    );
  });

  test('listLocationsApi GET on /world/locations (4-fold cross-CP)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { locations: [] } });
    await listLocationsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/locations');
  });

  test('listSocialProfilesApi GET on /social-profiles?qs', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { count: 0 } });
    await listSocialProfilesApi('feed_layer=lalaverse&limit=1');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/social-profiles?feed_layer=lalaverse&limit=1',
    );
  });

  test('listShowsApi GET on /shows (6-fold cross-CP, meets v2.17 §9.11 ceiling)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await listShowsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/shows');
  });

  test('listWorldEventsApi GET with showId+status (4-fold cross-CP)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    await listWorldEventsApi('s-1', 'draft');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/s-1/events?status=draft');
  });

  // ── 3-way reuse coverage (CP14 + CP15 helper-reuse density precedent) ──

  describe('Helper-reuse density (3× reuse on getPageContentApi)', () => {
    test('getPageContentApi reused 3× across status-check probes (sites 1, 2, 4)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: {} } });
      // Simulate the 3 invocation contexts in WorldSetupGuide.jsx checkStatus():
      // 1. Check infrastructure (page_content/world_infrastructure)
      // 2. Check influencer systems (page_content/influencer_systems)
      // 3. Check cultural memory (page_content/cultural_memory)
      await getPageContentApi('world_infrastructure');
      await getPageContentApi('influencer_systems');
      await getPageContentApi('cultural_memory');
      expect(apiClient.get).toHaveBeenCalledTimes(3);
      const allCalls = vi.mocked(apiClient.get).mock.calls.map((c) => c[0]);
      expect(allCalls).toEqual([
        '/api/v1/page-content/world_infrastructure',
        '/api/v1/page-content/influencer_systems',
        '/api/v1/page-content/cultural_memory',
      ]);
    });
  });

  // ── Error path propagation ────────────────────────────────────────────

  describe('Error path propagation (each catch swallows → false fallback)', () => {
    test('getPageContentApi rejection propagates (caller falls back to false)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(getPageContentApi('x')).rejects.toThrow('not authorized');
    });

    test('listShowsApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listShowsApi()).rejects.toThrow('not authorized');
    });

    test('listWorldEventsApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('forbidden'));
      await expect(listWorldEventsApi('s', 'draft')).rejects.toThrow('forbidden');
    });
  });
});
