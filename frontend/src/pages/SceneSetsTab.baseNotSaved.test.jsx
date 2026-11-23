/**
 * Generation B1 (Evoni, 2026-11-23): a base run that made a picture and did
 * not save it (the event's Place locked meanwhile, or the base was approved
 * meanwhile) leaves the set with the status it had, usually 'complete' with
 * its old picture, and the reason in base_generation.last_error. The page
 * read that as a new base and said "Base image regenerated!". It now says
 * the recorded reason; a run that really finished still says it finished.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { baseNotSavedReason, waitForBase, baseRunToast } from './SceneSetsTab';

const REASON = "This event's episode is accepted: its Place is locked The image was generated but it was not saved. Generating it again costs again.";
const SAVED = { id: 'set-1', generation_status: 'complete', base_still_url: 'https://x/base.jpg', base_generation: { generated_at: '2026-11-20T09:00:00.000Z' } };
// What the server leaves after a run that was not saved: failed_at is the database's NOW().
const NOT_SAVED = { ...SAVED, base_generation: { ...SAVED.base_generation, last_error: REASON, failed_at: '2026-11-23T10:05:00.123456+00:00' } };
const read = (set) => ({ data: { success: true, data: set } });
const sleep = () => Promise.resolve();
const REGENERATE = { done: 'Base image regenerated!', failed: 'Regeneration failed or timed out' };

describe('baseNotSavedReason', () => {
  test('the recorded reason when it is newer than the last saved base', () => {
    expect(baseNotSavedReason(NOT_SAVED)).toBe(REASON);
    // A set that never had a base: restored to pending.
    expect(baseNotSavedReason({ id: 's', generation_status: 'pending', base_generation: { last_error: REASON, failed_at: '2026-11-23T10:05:00Z' } })).toBe(REASON);
  });
  test('null for a base generated or uploaded since, no recorded error, and a set generating or failed', () => {
    expect(baseNotSavedReason(SAVED)).toBeNull();
    expect(baseNotSavedReason({ ...NOT_SAVED, base_generation: { ...NOT_SAVED.base_generation, generated_at: '2026-11-23T10:06:00.000Z' } })).toBeNull();
    expect(baseNotSavedReason({ ...NOT_SAVED, base_generation: { ...NOT_SAVED.base_generation, generated_at: null, uploaded_at: '2026-11-23T11:00:00.000Z' } })).toBeNull();
    expect(baseNotSavedReason({ ...NOT_SAVED, generation_status: 'generating' })).toBeNull();
    expect(baseNotSavedReason({ ...NOT_SAVED, generation_status: 'failed' })).toBeNull();
    expect(baseNotSavedReason({ ...NOT_SAVED, base_generation: { last_error: REASON, failed_at: 'not a date' } })).toBeNull();
    expect(baseNotSavedReason({ id: 's', generation_status: 'complete', base_generation: null })).toBeNull();
    expect(baseNotSavedReason(null)).toBeNull();
  });
});

describe('waitForBase and the toast it leads to', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('a real success: completed, and the success toast', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(read({ ...SAVED, generation_status: 'generating' }))
      .mockResolvedValueOnce(read({ ...SAVED, base_generation: { generated_at: '2026-11-23T10:06:00.000Z' } }));
    const end = await waitForBase('set-1', { sleep });
    expect(end).toEqual({ status: 'completed' });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1');
    expect(baseRunToast(end, REGENERATE)).toEqual(['Base image regenerated!']);
  });

  test('a success after an older recorded error is still a success', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(read({
      ...NOT_SAVED, base_generation: { ...NOT_SAVED.base_generation, generated_at: '2026-11-23T10:06:00.000Z' },
    }));
    expect(baseRunToast(await waitForBase('set-1', { sleep }), REGENERATE)).toEqual(['Base image regenerated!']);
  });

  test('a run that was not saved: the set is complete again, and the toast is the recorded reason, not "Base image regenerated!"', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(read({ ...SAVED, generation_status: 'generating' }))
      .mockResolvedValueOnce(read(NOT_SAVED));
    const end = await waitForBase('set-1', { sleep });
    expect(end).toEqual({ status: 'not_saved', error: REASON });
    expect(baseRunToast(end, REGENERATE)).toEqual([REASON, 'error']);
  });

  test('a first base that was not saved (the set is pending again) ends at once with the reason, not at the timeout', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(read({ id: 'set-1', generation_status: 'pending', base_generation: { last_error: REASON, failed_at: '2026-11-23T10:05:00Z' } }));
    const end = await waitForBase('set-1', { sleep, maxPolls: 30 });
    expect(end).toEqual({ status: 'not_saved', error: REASON });
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(baseRunToast(end, { done: 'Base generated for "Hall"', failed: 'Base generation failed or timed out' })).toEqual([REASON, 'error']);
  });

  test('failed, timed out and cancelled are as before', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(read({ ...SAVED, generation_status: 'failed' }));
    const failed = await waitForBase('set-1', { sleep });
    expect(failed).toEqual({ status: 'failed' });
    expect(baseRunToast(failed, REGENERATE)).toEqual(['Regeneration failed or timed out', 'error']);

    vi.mocked(apiClient.get).mockResolvedValue(read({ ...SAVED, generation_status: 'generating' }));
    const slow = await waitForBase('set-1', { sleep, maxPolls: 2 });
    expect(slow).toEqual({ status: 'timeout' });
    expect(baseRunToast(slow, REGENERATE)).toEqual(['Regeneration failed or timed out', 'error']);

    expect(await waitForBase('set-1', { sleep, alive: () => false })).toEqual({ status: 'cancelled' });

    // A read that fails is tried again.
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(read(SAVED));
    expect(await waitForBase('set-1', { sleep })).toEqual({ status: 'completed' });
  });
});
