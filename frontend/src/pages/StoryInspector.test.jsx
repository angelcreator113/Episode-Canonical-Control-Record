/**
 * StoryInspector — CP15 (listStorySparksApi 2× reuse).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

vi.mock('./storyEngineConstants', () => ({
  PHASE_COLORS: {}, PHASE_LABELS: {}, TYPE_ICONS: {}, WORLD_LABELS: {},
  getReadingTime: () => 0,
  API_BASE: '/api/v1',
}));

import apiClient from '../services/api';
import { listStorySparksApi } from './StoryInspector';

describe('StoryInspector — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listStorySparksApi GET on /story-health/story-sparks/:char (2× reuse)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { sparks: [] } });
    await listStorySparksApi('justawoman');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/story-health/story-sparks/justawoman');
  });

  test('rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listStorySparksApi('x')).rejects.toThrow('not authorized');
  });
});
