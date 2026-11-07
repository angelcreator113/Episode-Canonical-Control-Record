/**
 * #3714 R1: sceneService.animateScene never sends a paid animation twice by
 * accident: one request per scene at a time, and after an unknown outcome
 * at Runway, no new request for that scene until the caller confirms.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from './api';
import sceneService from './sceneService';

const unknownReply = () => Object.assign(new Error('Request failed with status code 502'), {
  response: { status: 502, data: { success: false, code: 'PROVIDER_OUTCOME_UNKNOWN', retryable: false, job_id: 'task-9', error: 'Runway may have started this animation.' } },
});

describe('sceneService.animateScene', () => {
  beforeEach(() => vi.mocked(api.post).mockReset());

  test('posts the request and returns the data', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { video_url: 'v' } } });
    const out = await sceneService.animateScene('scene-ok', { prompt: 'p', duration: 5 });
    expect(api.post).toHaveBeenCalledWith('/api/v1/scenes/scene-ok/animate', { image_url: undefined, prompt: 'p', duration: 5, camera_motion: undefined });
    expect(out.success).toBe(true);
  });

  test('an unknown outcome is a non-retryable error with the task id, and blocks the next call until confirmed', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(unknownReply());
    await expect(sceneService.animateScene('scene-unknown', { prompt: 'p' })).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN', retryable: false, jobId: 'task-9' });
    expect(api.post).toHaveBeenCalledTimes(1);

    await expect(sceneService.animateScene('scene-unknown', { prompt: 'p' })).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN', jobId: 'task-9' });
    expect(api.post).toHaveBeenCalledTimes(1);

    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });
    await sceneService.animateScene('scene-unknown', { prompt: 'p', confirmAfterUnknown: true });
    expect(api.post).toHaveBeenCalledTimes(2);
    // A success clears the block.
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });
    await sceneService.animateScene('scene-unknown', { prompt: 'p' });
    expect(api.post).toHaveBeenCalledTimes(3);
  });

  test('other errors pass through unchanged and do not block the scene', async () => {
    const plain = Object.assign(new Error('400'), { response: { status: 400, data: { code: 'SOURCE_NOT_ALLOWED' } } });
    vi.mocked(api.post).mockRejectedValueOnce(plain);
    await expect(sceneService.animateScene('scene-400', { prompt: 'p' })).rejects.toBe(plain);
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });
    await sceneService.animateScene('scene-400', { prompt: 'p' });
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  test('a second call for the same scene while one is in flight is refused without a request', async () => {
    let release = null;
    const pending = new Promise((resolve) => { release = resolve; });
    vi.mocked(api.post).mockReturnValueOnce(pending);
    const first = sceneService.animateScene('scene-busy', { prompt: 'p' });
    await expect(sceneService.animateScene('scene-busy', { prompt: 'p' })).rejects.toMatchObject({ code: 'ANIMATE_IN_FLIGHT', retryable: false });
    expect(api.post).toHaveBeenCalledTimes(1);
    release({ data: { success: true } });
    await expect(first).resolves.toEqual({ success: true });
  });
});
