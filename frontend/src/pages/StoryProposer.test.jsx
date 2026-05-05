/**
 * StoryProposer — Track 6 CP8 behavioral tests (file 9 of 10).
 *
 * 7 fetch sites migrated via 7 module-scope helpers. listRegistriesApi
 * duplicated locally per v2.12 §9.11 (CP3 + CP6 + CP7 + CP8 RelationshipEngine
 * also have it).
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
  listRegistriesApi,
  listFlaggedGrowthApi,
  proposeSceneApi,
  updateSceneProposalApi,
  acceptSceneProposalApi,
  dismissSceneProposalApi,
  reviewGrowthFlagApi,
} from './StoryProposer';

describe('StoryProposer — Track 6 CP8 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listRegistriesApi GET on /character-registry/registries', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { registries: [] } });
    await listRegistriesApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/registries');
  });

  test('listFlaggedGrowthApi GET on /memories/character-growth/flagged', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { flags: [] } });
    await listFlaggedGrowthApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/character-growth/flagged');
  });

  test('proposeSceneApi POST on /memories/propose-scene', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { proposal: {}, arc_state: {} } });
    const payload = { book_id: 'b1', chapter_id: 'ch1', registry_id: 'r1' };
    await proposeSceneApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/memories/propose-scene', payload);
  });

  test('updateSceneProposalApi PATCH on /memories/scene-proposals/:id', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    await updateSceneProposalApi('p-1', { scene_brief: 'edit', tone: 'longing' });
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/memories/scene-proposals/p-1',
      { scene_brief: 'edit', tone: 'longing' },
    );
  });

  test('acceptSceneProposalApi POST on /memories/scene-proposals/:id/accept', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { ready_to_generate: true } });
    await acceptSceneProposalApi('p-1', { tone_override: 'tension' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/scene-proposals/p-1/accept',
      { tone_override: 'tension' },
    );
  });

  test('dismissSceneProposalApi POST on /memories/scene-proposals/:id/dismiss (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await dismissSceneProposalApi('p-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/memories/scene-proposals/p-1/dismiss');
  });

  test('reviewGrowthFlagApi POST on /memories/character-growth/:flagId/review', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await reviewGrowthFlagApi('f-1', { decision: 'approved' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/character-growth/f-1/review',
      { decision: 'approved' },
    );
  });

  test('listRegistriesApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listRegistriesApi()).rejects.toThrow('not authorized');
  });

  test('proposeSceneApi exposes response.data.error for UX surface', async () => {
    const httpErr = new Error('validation');
    httpErr.response = { status: 400, data: { error: 'no eligible chars' } };
    vi.mocked(apiClient.post).mockRejectedValue(httpErr);
    await expect(proposeSceneApi({})).rejects.toMatchObject({
      response: { data: { error: 'no eligible chars' } },
    });
  });
});
