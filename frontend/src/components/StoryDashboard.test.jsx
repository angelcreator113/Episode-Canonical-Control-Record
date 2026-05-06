/**
 * StoryDashboard — Track 6 CP10 behavioral tests (file 7 of 8).
 *
 * 6 fetch sites migrated via 6 module-scope helpers. URL composition
 * preserved verbatim per v2.16 §9.11 — API='' empty default; resulting
 * URLs are relative paths (no /api/v1 prefix). apiClient.baseURL is also ''.
 * If pre-existing bug, surfaced for Step 3 audit. Tests assert the exact
 * relative URL strings apiClient receives.
 *
 * listFlaggedGrowthApi duplicated locally per v2.12 §9.11 (CP8 StoryProposer
 * has it).
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
  postArcStageApi,
  listRegistryCharactersApi,
  listSceneProposalsApi,
  listUnacknowledgedReviewsApi,
  listFlaggedGrowthApi,
  acknowledgeReviewApi,
} from './StoryDashboard';

describe('StoryDashboard — Track 6 CP10 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  // URL strings preserve API='' empty default + ${API}/... template;
  // tests assert the exact relative-path string apiClient receives.

  test('postArcStageApi POST on /memories/arc-stage (relative path)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await postArcStageApi({ book_id: 'b-1' });
    expect(apiClient.post).toHaveBeenCalledWith('/memories/arc-stage', { book_id: 'b-1' });
  });

  test('listRegistryCharactersApi GET on /character-registry/:id/characters (relative)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { characters: [] } });
    await listRegistryCharactersApi('reg-1');
    expect(apiClient.get).toHaveBeenCalledWith('/character-registry/reg-1/characters');
  });

  test('listSceneProposalsApi GET with book_id + limit query (relative)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { proposals: [] } });
    await listSceneProposalsApi('b-1', 8);
    expect(apiClient.get).toHaveBeenCalledWith('/memories/scene-proposals?book_id=b-1&limit=8');
  });

  test('listUnacknowledgedReviewsApi GET on /reviews/unacknowledged (relative)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { reviews: [] } });
    await listUnacknowledgedReviewsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/reviews/unacknowledged');
  });

  test('listFlaggedGrowthApi GET (CP8 dup, relative)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { flags: [] } });
    await listFlaggedGrowthApi();
    expect(apiClient.get).toHaveBeenCalledWith('/memories/character-growth/flagged');
  });

  test('acknowledgeReviewApi POST on /reviews/:id/acknowledge (no body, relative)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await acknowledgeReviewApi('r-1');
    expect(apiClient.post).toHaveBeenCalledWith('/reviews/r-1/acknowledge');
  });

  describe('Error path propagation', () => {
    test('postArcStageApi rejection propagates (caller swallows)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not authorized'));
      await expect(postArcStageApi({})).rejects.toThrow('not authorized');
    });

    test('listRegistryCharactersApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(listRegistryCharactersApi('missing')).rejects.toThrow('not found');
    });

    test('acknowledgeReviewApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
      await expect(acknowledgeReviewApi('r-1')).rejects.toThrow('forbidden');
    });
  });
});
