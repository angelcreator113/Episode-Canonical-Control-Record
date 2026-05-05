/**
 * useGenerationJob — Track 6 CP9 behavioral tests (file 6 of 8).
 *
 * 5 fetch sites migrated via 5 module-scope helpers exported from the hook
 * module. Polling lifecycle preserved (setInterval inside hook callbacks
 * uses apiClient calls; clearInterval semantics unchanged). Hook consumers
 * (callers of useGenerationJob) are unchanged.
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
  getPipelineStatusApi,
  getBatchStatusApi,
  getBatchStoryApi,
  startPipelineBackgroundApi,
  startBatchBackgroundApi,
} from './useGenerationJob';

describe('useGenerationJob — Track 6 CP9 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getPipelineStatusApi GET on /memories/pipeline-generate-status/:jobId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { status: 'running' } });
    await getPipelineStatusApi('job-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/pipeline-generate-status/job-1');
  });

  test('getBatchStatusApi GET on /memories/batch-generate-status/:jobId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { completed: 0, total: 5 } });
    await getBatchStatusApi('job-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/batch-generate-status/job-1');
  });

  test('getBatchStoryApi GET on /memories/batch-generate-story/:jobId/:storyNum', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { title: 'Story 3' } });
    await getBatchStoryApi('job-1', 3);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/batch-generate-story/job-1/3');
  });

  test('startPipelineBackgroundApi POST on /memories/pipeline-generate-background', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { jobId: 'new-job' } });
    const payload = { characterKey: 'lala', storyNumber: 1, taskBrief: {}, previousStories: [] };
    await startPipelineBackgroundApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/pipeline-generate-background',
      payload,
    );
  });

  test('startBatchBackgroundApi POST on /memories/batch-generate-background', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { jobId: 'batch-1', total: 5 } });
    const payload = { characterKey: 'lala', taskBriefs: [], previousStories: [] };
    await startBatchBackgroundApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/batch-generate-background',
      payload,
    );
  });

  describe('Error path propagation (404 detection for poll-loop notFound counter)', () => {
    test('getPipelineStatusApi 404 exposes response.status for caller', async () => {
      const httpErr = new Error('not found');
      httpErr.response = { status: 404 };
      vi.mocked(apiClient.get).mockRejectedValue(httpErr);
      await expect(getPipelineStatusApi('missing')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    test('startPipelineBackgroundApi rejection propagates (caller toast + reset)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('busy'));
      await expect(startPipelineBackgroundApi({})).rejects.toThrow('busy');
    });

    test('startBatchBackgroundApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('quota exceeded'));
      await expect(startBatchBackgroundApi({})).rejects.toThrow('quota exceeded');
    });
  });
});
