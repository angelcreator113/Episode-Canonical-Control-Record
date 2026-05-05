/**
 * ImportDraftModal — Track 6 CP8 behavioral tests (file 5 of 10).
 *
 * 1 fetch site migrated via importChapterApi (file-local duplicate of CP3
 * WriteMode helper per v2.12 §9.11).
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
import { importChapterApi } from './ImportDraftModal';

describe('ImportDraftModal — Track 6 CP8 module-scope helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('importChapterApi POST on /storyteller/chapters/:chapterId/import', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { lines: [] } });
    await importChapterApi('ch-1', { raw_text: 'LINE 1\nopening', mode: 'replace' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/ch-1/import',
      { raw_text: 'LINE 1\nopening', mode: 'replace' },
    );
  });

  test('importChapterApi exposes response.data.error for UX surface', async () => {
    const httpErr = new Error('validation');
    httpErr.response = { status: 400, data: { error: 'no LINE markers' } };
    vi.mocked(apiClient.post).mockRejectedValue(httpErr);
    await expect(importChapterApi('ch-1', {})).rejects.toMatchObject({
      response: { data: { error: 'no LINE markers' } },
    });
  });
});
