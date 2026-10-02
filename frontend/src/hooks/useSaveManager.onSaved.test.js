/**
 * useSaveManager hands the save's response to onSaved, so the Timeline
 * adopts the ids of the scene rows its save created (Evoni's answer L12a,
 * 2026-10-02, §8(hh)).
 */
import { vi, describe, test, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ saveEpisodeData: vi.fn() }));

import { saveEpisodeData } from '../services/api';
import useSaveManager from './useSaveManager';

describe('useSaveManager onSaved (L12a)', () => {
  test('a manual save calls onSaved with the response body', async () => {
    const body = { success: true, scenes: [{ client_id: 'scene-1', id: 'row-1' }] };
    vi.mocked(saveEpisodeData).mockResolvedValue({ data: body });
    const onSaved = vi.fn();
    const { result } = renderHook(() => useSaveManager({
      episodeId: 'ep-1', getSavePayload: () => ({ scenes: [{ id: 'scene-1', scene_number: 1, title: 'One' }] }), onSaved,
    }));
    act(() => { result.current.save(); });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(body));
    expect(saveEpisodeData).toHaveBeenCalledWith('ep-1', { scenes: [{ id: 'scene-1', scene_number: 1, title: 'One' }] });
    expect(result.current.saveStatus).toBe('saved');
  });

  test('a failed save does not call onSaved', async () => {
    vi.mocked(saveEpisodeData).mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSaved = vi.fn();
    const { result } = renderHook(() => useSaveManager({ episodeId: 'ep-1', getSavePayload: () => ({ scenes: [] }), onSaved }));
    act(() => { result.current.save(); });
    await waitFor(() => expect(result.current.saveStatus).toBe('error'));
    expect(onSaved).not.toHaveBeenCalled();
  });
});
