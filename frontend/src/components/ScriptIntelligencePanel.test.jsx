/**
 * ScriptIntelligencePanel — CP15.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { generateScriptMetadataApi } from './ScriptIntelligencePanel';

describe('ScriptIntelligencePanel — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('generateScriptMetadataApi POST on /memories/script-metadata', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const payload = { script_content: 'draft', episode_title: 'Pilot' };
    await generateScriptMetadataApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/memories/script-metadata', payload);
  });

  test('rejection exposes response.data.error', async () => {
    const httpErr = new Error('rate');
    httpErr.response = { status: 429, data: { error: 'too many' } };
    vi.mocked(apiClient.post).mockRejectedValue(httpErr);
    await expect(generateScriptMetadataApi({})).rejects.toMatchObject({
      response: { data: { error: 'too many' } },
    });
  });
});
