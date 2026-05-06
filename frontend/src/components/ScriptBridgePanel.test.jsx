/**
 * ScriptBridgePanel — CP15.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { generateScriptFromBookApi } from './ScriptBridgePanel';

describe('ScriptBridgePanel — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('generateScriptFromBookApi POST on /memories/generate-script-from-book', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { script: '...' } });
    const payload = { book_id: 'b-1', line_count: 50 };
    await generateScriptFromBookApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/memories/generate-script-from-book', payload);
  });

  test('rejection exposes response.data.error', async () => {
    const httpErr = new Error('failed');
    httpErr.response = { status: 500, data: { error: 'gen failed' } };
    vi.mocked(apiClient.post).mockRejectedValue(httpErr);
    await expect(generateScriptFromBookApi({})).rejects.toMatchObject({
      response: { data: { error: 'gen failed' } },
    });
  });
});
