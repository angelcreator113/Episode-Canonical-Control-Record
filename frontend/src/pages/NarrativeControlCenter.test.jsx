/**
 * NarrativeControlCenter — Track 6 CP8 behavioral tests (file 2 of 10).
 *
 * 1 fetch site migrated via getTierPipelineApi. The file's existing Track 4
 * fetchJSON wrapper covers other endpoints; this CP8 helper closes the one
 * remaining bare-fetch site at the PipelineTab useEffect.
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
import { getTierPipelineApi } from './NarrativeControlCenter';

describe('NarrativeControlCenter — Track 6 CP8 module-scope helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getTierPipelineApi GET on /tier/pipeline', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { pipelines: [], stats: null } });
    await getTierPipelineApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tier/pipeline');
  });

  test('getTierPipelineApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(getTierPipelineApi()).rejects.toThrow('not authorized');
  });
});
