/**
 * WritingRhythm — Track 6 CP9 behavioral tests (file 8 of 8).
 *
 * 5 fetch sites migrated via 5 module-scope helpers across /writing-rhythm/*
 * and /multi-product/*. URL composition note: API='' empty default in source
 * file — pre-migration shape preserved verbatim. Helpers use the same
 * `${API}/...` template so the URL string at the helper level matches the
 * pre-migration string. apiClient.baseURL is also '' (services/api.js); the
 * resulting URL is `/writing-rhythm/...` (no /api/v1 prefix). If this is a
 * pre-existing bug, it's flagged for Step 3 audit per v2.15 §9.11.
 *
 * Method verification: updateMultiProductStatusApi uses PATCH per backend
 * contract (verified at execution from line 192 of pre-migration code).
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
  getWritingRhythmStatsApi,
  getMultiProductAllApi,
  logWritingRhythmApi,
  setWritingRhythmGoalApi,
  updateMultiProductStatusApi,
} from './WritingRhythm';

describe('WritingRhythm — Track 6 CP9 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  // NOTE: URL strings preserve the pre-migration `${API}/...` template;
  // with API='' default, URL is '/writing-rhythm/...' (relative). Tests
  // assert the exact string apiClient receives.

  test('getWritingRhythmStatsApi GET on /writing-rhythm/stats', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { streak: 0 } });
    await getWritingRhythmStatsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/writing-rhythm/stats');
  });

  test('getMultiProductAllApi GET on /multi-product/all', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { content: [] } });
    await getMultiProductAllApi();
    expect(apiClient.get).toHaveBeenCalledWith('/multi-product/all');
  });

  test('logWritingRhythmApi POST on /writing-rhythm/log', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const payload = { scenes_proposed: 3, scenes_generated: 2, scenes_approved: 1, words_written: 1500, session_note: '' };
    await logWritingRhythmApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/writing-rhythm/log', payload);
  });

  test('setWritingRhythmGoalApi PATCH on /writing-rhythm/goal', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    const payload = { goal_type: 'weekly', target_scenes: 10, target_words: 5000, cadence: 'weekdays' };
    await setWritingRhythmGoalApi(payload);
    expect(apiClient.patch).toHaveBeenCalledWith('/writing-rhythm/goal', payload);
  });

  test('updateMultiProductStatusApi PATCH on /multi-product/:id/status (verified PATCH not PUT)', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    await updateMultiProductStatusApi('p-1', { status: 'approved' });
    expect(apiClient.patch).toHaveBeenCalledWith('/multi-product/p-1/status', { status: 'approved' });
  });

  describe('Error path propagation', () => {
    test('getWritingRhythmStatsApi rejection propagates (caller .catch null)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(getWritingRhythmStatsApi()).rejects.toThrow('not authorized');
    });

    test('logWritingRhythmApi exposes response.data.error for toast UX', async () => {
      const httpErr = new Error('validation');
      httpErr.response = { status: 400, data: { error: 'words required' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(logWritingRhythmApi({})).rejects.toMatchObject({
        response: { data: { error: 'words required' } },
      });
    });

    test('setWritingRhythmGoalApi rejection propagates', async () => {
      vi.mocked(apiClient.patch).mockRejectedValue(new Error('forbidden'));
      await expect(setWritingRhythmGoalApi({})).rejects.toThrow('forbidden');
    });

    test('updateMultiProductStatusApi rejection propagates', async () => {
      vi.mocked(apiClient.patch).mockRejectedValue(new Error('not found'));
      await expect(updateMultiProductStatusApi('p-1', {})).rejects.toThrow('not found');
    });
  });
});
