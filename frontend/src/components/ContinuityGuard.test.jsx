/**
 * ContinuityGuard — Track 6 CP11 behavioral tests (file 15 of 17).
 *
 * 3 fetch sites migrated via 3 fresh helpers. Two related panels
 * (ContinuityGuard + RewriteOptions) live in same file.
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
  continuityCheckApi,
  rewriteOptionsApi,
  updateLineApi,
} from './ContinuityGuard';

describe('ContinuityGuard — Track 6 CP11 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('continuityCheckApi POST on /memories/continuity-check returns full axios response', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { issues: [] } });
    const out = await continuityCheckApi({ book_id: 'b-1', chapter_id: 'c-1' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/continuity-check',
      { book_id: 'b-1', chapter_id: 'c-1' },
    );
    expect(out.data).toEqual({ issues: [] });
  });

  test('rewriteOptionsApi POST on /memories/rewrite-options', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { options: [] } });
    await rewriteOptionsApi({ line_id: 'l-1', content: 'hello' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/rewrite-options',
      { line_id: 'l-1', content: 'hello' },
    );
  });

  test('updateLineApi PUT on /storyteller/lines/:id', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await updateLineApi('l-1', { text: 'rewritten', status: 'edited' });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/storyteller/lines/l-1',
      { text: 'rewritten', status: 'edited' },
    );
  });

  describe('Error path propagation', () => {
    test('continuityCheckApi rejection propagates (caller logs)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not authorized'));
      await expect(continuityCheckApi({})).rejects.toThrow('not authorized');
    });

    test('rewriteOptionsApi rejection exposes response.data.error for UX', async () => {
      const httpErr = new Error('rate limited');
      httpErr.response = { status: 429, data: { error: 'rewrite engine cooldown' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(rewriteOptionsApi({})).rejects.toMatchObject({
        response: { data: { error: 'rewrite engine cooldown' } },
      });
    });

    test('updateLineApi rejection propagates', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
      await expect(updateLineApi('l-1', {})).rejects.toThrow('forbidden');
    });
  });
});
