/**
 * useNextSlot: the season's next open slot, from one read of the season
 * roadmap (PR-02 of docs/design/2026-11-studio-home-episode-command-center.md).
 * The hook was Producer Mode's own until it moved here; these are its first
 * direct tests: loading, the slot found, no season, a failed read, and Retry.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../services/api';
import useNextSlot from './useNextSlot';

const SLOT_3 = { id: 's3', slot_number: 3, label: 'S1 · E3', state: 'needs_event', intention: { story_purpose: 'A first stumble' } };
const SLOT_4 = { id: 's4', slot_number: 4, label: 'S1 · E4', state: 'event_ready', event: { id: 'ev-4', name: 'The Honey Table' } };
const SLOT_9 = { id: 's9', slot_number: 9, label: 'S1 · E9' };
const roadmap = (next) => ({ next_slot_number: next, phases: [{ phase: 1, slots: [SLOT_3, SLOT_4] }, { phase: 2, slots: [SLOT_9] }] });
const answers = (value) => ({ data: { roadmap: value } });
const urls = () => vi.mocked(api.get).mock.calls.map(([url]) => url);

describe('useNextSlot', () => {
  let errors;

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => { errors.mockRestore(); });

  test('it starts loading, then gives the slot the roadmap names as next', async () => {
    vi.mocked(api.get).mockResolvedValue(answers(roadmap(4)));
    const { result } = renderHook(() => useNextSlot('show-1'));

    expect(result.current).toMatchObject({ loading: true, slot: null, failed: false });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ loading: false, slot: SLOT_4, failed: false, hasSeason: true });
    expect(typeof result.current.reload).toBe('function');
  });

  test('one read, of this show\'s season roadmap', async () => {
    vi.mocked(api.get).mockResolvedValue(answers(roadmap(3)));
    const { result } = renderHook(() => useNextSlot('show-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(urls()).toEqual(['/api/v1/world/show-1/season/roadmap']);
  });

  test('the slot is found in any part of the season, with what the roadmap says about it', async () => {
    vi.mocked(api.get).mockResolvedValue(answers(roadmap(9)));
    const { result } = renderHook(() => useNextSlot('show-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.slot).toEqual(SLOT_9);

    vi.mocked(api.get).mockResolvedValue(answers(roadmap(3)));
    await act(async () => { await result.current.reload(); });
    expect(result.current.slot.intention.story_purpose).toBe('A first stumble');
  });

  test('a season with no next slot (every slot has an episode): no slot, and it still has a season', async () => {
    vi.mocked(api.get).mockResolvedValue(answers(roadmap(null)));
    const { result } = renderHook(() => useNextSlot('show-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ slot: null, failed: false, hasSeason: true });
  });

  test('a next slot number that no slot carries: no slot, not an error', async () => {
    vi.mocked(api.get).mockResolvedValue(answers(roadmap(17)));
    const { result } = renderHook(() => useNextSlot('show-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ slot: null, failed: false, hasSeason: true });
  });

  test('no season yet: no slot, and hasSeason is false', async () => {
    for (const body of [{ data: { roadmap: null } }, { data: {} }, {}]) {
      vi.mocked(api.get).mockReset().mockResolvedValue(body);
      const { result, unmount } = renderHook(() => useNextSlot('show-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current).toMatchObject({ slot: null, failed: false, hasSeason: false });
      unmount();
    }
  });

  test('a roadmap with no parts: no slot, and it still has a season', async () => {
    vi.mocked(api.get).mockResolvedValue(answers({ next_slot_number: 1 }));
    const { result } = renderHook(() => useNextSlot('show-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ slot: null, failed: false, hasSeason: true });
  });

  test('a failed read says it failed, with no slot, and logs it', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'));
    const { result } = renderHook(() => useNextSlot('show-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ loading: false, slot: null, failed: true });
    expect(errors).toHaveBeenCalledTimes(1);
  });

  test('Retry reads again: loading while it asks, then the slot, and the failure is cleared', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network Error'));
    const { result } = renderHook(() => useNextSlot('show-1'));
    await waitFor(() => expect(result.current.failed).toBe(true));

    let finish;
    vi.mocked(api.get).mockImplementation(() => new Promise((resolve) => { finish = () => resolve(answers(roadmap(4))); }));
    let retry;
    act(() => { retry = result.current.reload(); });
    expect(result.current).toMatchObject({ loading: true, failed: false, slot: null });

    await act(async () => { finish(); await retry; });
    expect(result.current).toMatchObject({ loading: false, failed: false, slot: SLOT_4, hasSeason: true });
    expect(urls()).toEqual(['/api/v1/world/show-1/season/roadmap', '/api/v1/world/show-1/season/roadmap']);
  });

  test('a retry that fails again still says failed', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'));
    const { result } = renderHook(() => useNextSlot('show-1'));
    await waitFor(() => expect(result.current.failed).toBe(true));
    await act(async () => { await result.current.reload(); });
    expect(result.current).toMatchObject({ loading: false, failed: true, slot: null });
    expect(errors).toHaveBeenCalledTimes(2);
  });

  test('a reload keeps the slot on screen while it asks', async () => {
    vi.mocked(api.get).mockResolvedValue(answers(roadmap(4)));
    const { result } = renderHook(() => useNextSlot('show-1'));
    await waitFor(() => expect(result.current.slot).toEqual(SLOT_4));

    let finish;
    vi.mocked(api.get).mockImplementation(() => new Promise((resolve) => { finish = () => resolve(answers(roadmap(3))); }));
    let again;
    act(() => { again = result.current.reload(); });
    expect(result.current).toMatchObject({ loading: true, slot: SLOT_4 });
    await act(async () => { finish(); await again; });
    expect(result.current.slot).toEqual(SLOT_3);
  });

  test('another show: the roadmap is read again, for that show', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => answers(roadmap(url.includes('show-2') ? 9 : 3)));
    const { result, rerender } = renderHook(({ showId }) => useNextSlot(showId), { initialProps: { showId: 'show-1' } });
    await waitFor(() => expect(result.current.slot).toEqual(SLOT_3));

    rerender({ showId: 'show-2' });
    await waitFor(() => expect(result.current.slot).toEqual(SLOT_9));
    expect(urls()).toEqual(['/api/v1/world/show-1/season/roadmap', '/api/v1/world/show-2/season/roadmap']);
  });

  test('rendering again with the same show does not read again', async () => {
    vi.mocked(api.get).mockResolvedValue(answers(roadmap(4)));
    const { result, rerender } = renderHook(({ showId }) => useNextSlot(showId), { initialProps: { showId: 'show-1' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ showId: 'show-1' });
    rerender({ showId: 'show-1' });
    expect(urls()).toHaveLength(1);
  });
});
