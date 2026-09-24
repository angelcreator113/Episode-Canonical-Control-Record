import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import useWardrobeProcessing from './useWardrobeProcessing';
import { PROCESSING_POLL_INTERVAL_MS, PROCESSING_GIVE_UP_MS, PROCESSING_STATES } from '../utils/wardrobeProcessingState';

const item = { id: 'w-1', s3_url: 'https://b/w-1.jpg', s3_url_processed: null };
const tick = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('useWardrobeProcessing (Task #1769)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('does not poll when nothing is tracked', async () => {
    renderHook(() => useWardrobeProcessing(vi.fn()));
    await tick(PROCESSING_POLL_INTERVAL_MS * 5);
    expect(api.get).not.toHaveBeenCalled();
  });

  test('polls a tracked item, merges the processed URL, then stops', async () => {
    api.get
      .mockResolvedValueOnce({ data: { data: { ...item } } })
      .mockResolvedValueOnce({ data: { data: { ...item, s3_url_processed: 'https://b/w-1-nobg.png', name: 'x' } } });
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useWardrobeProcessing(onUpdate));

    act(() => { result.current.track('w-1'); });
    expect(result.current.stateFor(item)).toBe(PROCESSING_STATES.PROCESSING);

    await tick(PROCESSING_POLL_INTERVAL_MS);
    expect(api.get).toHaveBeenCalledWith('/api/v1/wardrobe/w-1');
    expect(onUpdate).not.toHaveBeenCalled();

    await tick(PROCESSING_POLL_INTERVAL_MS);
    expect(onUpdate).toHaveBeenCalledWith({ id: 'w-1', s3_url_processed: 'https://b/w-1-nobg.png' });
    expect(result.current.stateFor(item)).toBe(PROCESSING_STATES.NONE);

    await tick(PROCESSING_POLL_INTERVAL_MS * 5);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('gives up after the window and stops polling', async () => {
    api.get.mockResolvedValue({ data: { data: { ...item } } });
    const { result } = renderHook(() => useWardrobeProcessing(vi.fn()));
    act(() => { result.current.track('w-1'); });

    await tick(PROCESSING_GIVE_UP_MS + PROCESSING_POLL_INTERVAL_MS);
    expect(result.current.stateFor(item)).toBe(PROCESSING_STATES.STALLED);
    const calls = api.get.mock.calls.length;
    expect(calls).toBeLessThanOrEqual(Math.ceil(PROCESSING_GIVE_UP_MS / PROCESSING_POLL_INTERVAL_MS) + 1);

    await tick(PROCESSING_POLL_INTERVAL_MS * 10);
    expect(api.get.mock.calls.length).toBe(calls);
  });

  test('stops polling on unmount', async () => {
    api.get.mockResolvedValue({ data: { data: { ...item } } });
    const { result, unmount } = renderHook(() => useWardrobeProcessing(vi.fn()));
    act(() => { result.current.track('w-1'); });
    await tick(PROCESSING_POLL_INTERVAL_MS);
    const calls = api.get.mock.calls.length;
    unmount();
    await tick(PROCESSING_POLL_INTERVAL_MS * 10);
    expect(api.get.mock.calls.length).toBe(calls);
  });

  test('retry calls process-background and merges on success; failure goes back to stalled', async () => {
    api.get.mockResolvedValue({ data: { data: { ...item } } });
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useWardrobeProcessing(onUpdate));
    act(() => { result.current.track('w-1'); });
    await tick(PROCESSING_GIVE_UP_MS + PROCESSING_POLL_INTERVAL_MS);
    expect(result.current.stateFor(item)).toBe(PROCESSING_STATES.STALLED);

    api.post.mockRejectedValueOnce(new Error('remove.bg down'));
    await act(async () => { await result.current.retry('w-1'); });
    expect(api.post).toHaveBeenCalledWith('/api/v1/wardrobe/w-1/process-background');
    expect(result.current.stateFor(item)).toBe(PROCESSING_STATES.STALLED);

    api.post.mockResolvedValueOnce({ data: { success: true, data: { id: 'w-1', s3_url_processed: 'https://b/r.png' } } });
    await act(async () => { await result.current.retry('w-1'); });
    expect(onUpdate).toHaveBeenCalledWith({ id: 'w-1', s3_url_processed: 'https://b/r.png' });
    expect(result.current.stateFor(item)).toBe(PROCESSING_STATES.NONE);
  });

  test('dismiss clears the state', async () => {
    const { result } = renderHook(() => useWardrobeProcessing(vi.fn()));
    act(() => { result.current.track('w-1'); });
    act(() => { result.current.dismiss('w-1'); });
    expect(result.current.stateFor(item)).toBe(PROCESSING_STATES.NONE);
  });
});
