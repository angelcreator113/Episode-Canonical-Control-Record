/**
 * The page's waiting (audit of the Scene Sets page, 2026-10-15):
 *   - hasLiveGeneration: the auto-refresh polls only while a generation was
 *     touched in the last 15 minutes; a row a server restart left
 *     'generating' was polled every 5 seconds forever.
 *   - waitForJob: the Video button waits on its job and reports how it ended
 *     (it fired the job and never looked again).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { hasLiveGeneration, waitForJob } from './SceneSetsTab';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const ago = (min) => new Date(NOW - min * 60000).toISOString();

describe('hasLiveGeneration', () => {
  test('a set or angle generating within 15 minutes is live', () => {
    expect(hasLiveGeneration([{ generation_status: 'generating', updated_at: ago(2) }], { now: NOW })).toBe(true);
    expect(hasLiveGeneration([{ generation_status: 'complete', angles: [{ generation_status: 'generating', updated_at: ago(14) }] }], { now: NOW })).toBe(true);
  });
  test('a row left generating for longer, or nothing generating, is not', () => {
    expect(hasLiveGeneration([{ generation_status: 'generating', updated_at: ago(40) }], { now: NOW })).toBe(false);
    expect(hasLiveGeneration([{ generation_status: 'complete', angles: [{ generation_status: 'pending' }] }], { now: NOW })).toBe(false);
    expect(hasLiveGeneration([], { now: NOW })).toBe(false);
  });
  test('a generating row with no updated_at counts as live', () => {
    expect(hasLiveGeneration([{ generation_status: 'generating' }], { now: NOW })).toBe(true);
  });
});

describe('waitForJob', () => {
  const sleep = () => Promise.resolve();
  beforeEach(() => { vi.mocked(apiClient.get).mockReset(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

  test('returns the job once it completes or fails', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { data: { status: 'processing' } } })
      .mockResolvedValueOnce({ data: { data: { status: 'completed' } } });
    expect(await waitForJob('job-1', { sleep })).toEqual({ status: 'completed' });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/jobs/job-1');
  });

  test('a missing job, repeated errors or a long run end as failed, with a reason', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce({ response: { status: 404 } });
    expect(await waitForJob('gone', { sleep })).toMatchObject({ status: 'failed', error: 'The job was not found' });

    vi.mocked(apiClient.get).mockRejectedValue(new Error('offline'));
    expect(await waitForJob('j', { sleep })).toMatchObject({ status: 'failed', error: expect.stringMatching(/reach the server/) });

    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { status: 'queued' } } });
    expect(await waitForJob('slow', { sleep, maxPolls: 3 })).toMatchObject({ status: 'failed', error: expect.stringMatching(/Still running/) });
  });
});
