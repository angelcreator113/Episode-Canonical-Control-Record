/**
 * useSpecBuild (audit SCENE-04, 2026-10-03): a rejection at one second or
 * at ten leaves a stable error (nothing later overwrites it), the elapsed
 * time is real, success says what was built, and unmounting mid-build
 * fires nothing.
 */
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSpecBuild, { specBuiltText } from './useSpecBuild';

const deferred = () => { let resolve, reject; const p = new Promise((res, rej) => { resolve = res; reject = rej; }); return { p, resolve, reject }; };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useSpecBuild', () => {
  test.each([1, 10])('a rejection at %ss leaves the error on screen, and nothing overwrites it later', async (seconds) => {
    const d = deferred();
    const onToast = vi.fn();
    const { result } = renderHook(() => useSpecBuild({ request: () => d.p, onToast }));
    let done;
    act(() => { done = result.current.build({ force: true }); });
    expect(result.current.status).toBe('building');
    await act(async () => { await vi.advanceTimersByTimeAsync(seconds * 1000); });
    expect(result.current.elapsed).toBe(seconds);
    await act(async () => { d.reject(Object.assign(new Error('boom'), { response: { data: { error: 'Claude overloaded' } } })); await done; });
    expect(result.current).toMatchObject({ status: 'error', error: 'Claude overloaded', building: false });
    expect(onToast).toHaveBeenCalledWith('Claude overloaded', 'error');
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(result.current.status).toBe('error');
    expect(result.current.elapsed).toBe(seconds);
  });

  test('success says what was built and refreshes; a success:false answer is an error', async () => {
    const onToast = vi.fn(); const onRefresh = vi.fn(async () => {});
    const spec = { objects: [1, 2], zones: [1], camera_contracts: [1, 2, 3] };
    const { result } = renderHook(() => useSpecBuild({ request: async () => ({ data: { success: true, data: spec } }), onToast, onRefresh }));
    await act(async () => { await result.current.build({ force: true }); });
    expect(result.current.status).toBe('done');
    expect(onToast).toHaveBeenCalledWith('Scene spec rebuilt: 2 objects · 1 zones · 3 camera contracts');
    expect(onRefresh).toHaveBeenCalledTimes(1);

    const failed = renderHook(() => useSpecBuild({ request: async () => ({ data: { success: false, error: 'No base image' } }), onToast }));
    await act(async () => { await failed.result.current.build(); });
    expect(failed.result.current).toMatchObject({ status: 'error', error: 'No base image' });
    expect(specBuiltText({}, false)).toBe('Scene spec built: 0 objects · 0 zones · 0 camera contracts');
  });

  test('unmounting mid-build stops the clock and fires no toast', async () => {
    const d = deferred(); const onToast = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useSpecBuild({ request: () => d.p, onToast }));
    let done;
    act(() => { done = result.current.build(); });
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); d.reject(new Error('late')); await done; });
    expect(onToast).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
