/**
 * useSaveManager saves nothing while it is not enabled (Timeline Editor
 * redesign P0, 2026-11-02): not the auto-save timer, not save(), not Ctrl+S.
 * And it never runs two saves at once.
 */
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../services/api', () => ({ saveEpisodeData: vi.fn() }));

import { saveEpisodeData } from '../services/api';
import useSaveManager from './useSaveManager';

const payload = () => ({ scenes: [{ id: 's1', scene_number: 1, title: 'One' }] });

describe('useSaveManager while not enabled (P0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(saveEpisodeData).mockResolvedValue({ data: { success: true, scenes: [] } });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  test('save(), Ctrl+S and markDirty send nothing while disabled', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSaveManager({ episodeId: 'ep-1', getSavePayload: payload, enabled: false, autoSaveDelay: 50 }));
    act(() => { result.current.save(); });
    act(() => { fireEvent.keyDown(window, { key: 's', ctrlKey: true }); });
    act(() => { result.current.markDirty(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(saveEpisodeData).not.toHaveBeenCalled();
  });

  test('an auto-save pending when the hook is disabled is dropped, never sent', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ enabled }) => useSaveManager({ episodeId: 'ep-1', getSavePayload: payload, enabled, autoSaveDelay: 100 }),
      { initialProps: { enabled: true } });
    act(() => { result.current.markDirty(); });
    rerender({ enabled: false });
    act(() => { vi.advanceTimersByTime(500); });
    expect(saveEpisodeData).not.toHaveBeenCalled();
  });

  test('a getSavePayload that answers null sends nothing', async () => {
    const { result } = renderHook(() => useSaveManager({ episodeId: 'ep-1', getSavePayload: () => null, enabled: true }));
    act(() => { result.current.save(); });
    await act(async () => { await Promise.resolve(); });
    expect(saveEpisodeData).not.toHaveBeenCalled();
  });

  test('enabled: Ctrl+S saves once', async () => {
    renderHook(() => useSaveManager({ episodeId: 'ep-1', getSavePayload: payload, enabled: true }));
    act(() => { fireEvent.keyDown(window, { key: 's', ctrlKey: true }); });
    await waitFor(() => expect(saveEpisodeData).toHaveBeenCalledTimes(1));
  });

  test('a save asked for while one is in flight runs once, after it', async () => {
    let finish;
    vi.mocked(saveEpisodeData).mockImplementationOnce(() => new Promise((r) => { finish = r; }));
    const { result } = renderHook(() => useSaveManager({ episodeId: 'ep-1', getSavePayload: payload, enabled: true }));
    act(() => { result.current.save(); });
    act(() => { result.current.save(); });
    act(() => { result.current.save(); });
    expect(saveEpisodeData).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ data: { success: true, scenes: [] } }); });
    await waitFor(() => expect(saveEpisodeData).toHaveBeenCalledTimes(2));
  });
});
