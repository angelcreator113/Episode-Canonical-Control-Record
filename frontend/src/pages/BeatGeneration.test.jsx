/**
 * BeatGeneration — Track 3 behavioral tests for migrated apiClient helpers.
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
  fetchEpisodeForBeats,
  fetchScenesByEpisode,
  fetchSceneDetail,
  generateSceneBeats,
  fetchSceneComposition,
} from './BeatGeneration';

describe('BeatGeneration — Track 3 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('fetchEpisodeForBeats calls apiClient.get on /episodes/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 'ep-1' } });
    await fetchEpisodeForBeats('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1');
  });

  test('fetchScenesByEpisode calls apiClient.get with query string', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await fetchScenesByEpisode('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scenes?episode_id=ep-1');
  });

  test('fetchSceneDetail calls apiClient.get on /scenes/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 'sc-1' } });
    await fetchSceneDetail('sc-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scenes/sc-1');
  });

  test('generateSceneBeats calls apiClient.post with scriptLines payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { count: 5 } });
    const lines = [{ text: 'Hello' }];
    await generateSceneBeats('sc-1', lines);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/scenes/sc-1/beats/generate',
      { scriptLines: lines }
    );
  });

  test('fetchSceneComposition calls apiClient.get on /scenes/:id/composition', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { total_beats: 0 } });
    await fetchSceneComposition('sc-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scenes/sc-1/composition');
  });

  test('error path — generateSceneBeats rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('LLM failed'));
    await expect(generateSceneBeats('sc-1', [])).rejects.toThrow('LLM failed');
  });
});
