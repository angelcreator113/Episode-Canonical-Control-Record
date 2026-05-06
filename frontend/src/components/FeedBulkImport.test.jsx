/**
 * FeedBulkImport — CP15 (4th partial-migration extension).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { listFeedBulkJobsApi, parseFeedBulkCsvApi } from './FeedBulkImport';

describe('FeedBulkImport — Track 6 CP15 partial-migration extension', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listFeedBulkJobsApi GET on /social-profiles/bulk/jobs', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { jobs: [] } });
    await listFeedBulkJobsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/social-profiles/bulk/jobs');
  });

  test('parseFeedBulkCsvApi POST on /social-profiles/bulk/parse-csv with text wrapper', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { creators: [] } });
    await parseFeedBulkCsvApi('handle,platform\nlala,instagram');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/social-profiles/bulk/parse-csv',
      { text: 'handle,platform\nlala,instagram' },
    );
  });

  test('rejection exposes response.data.error', async () => {
    const httpErr = new Error('parse');
    httpErr.response = { status: 400, data: { error: 'malformed csv' } };
    vi.mocked(apiClient.post).mockRejectedValue(httpErr);
    await expect(parseFeedBulkCsvApi('bad')).rejects.toMatchObject({
      response: { data: { error: 'malformed csv' } },
    });
  });
});
