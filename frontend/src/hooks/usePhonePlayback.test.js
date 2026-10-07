import { vi, describe, beforeEach, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('./usePhonePlaythrough', () => ({ default: () => null }));

import api from '../services/api';
import usePhonePlayback from './usePhonePlayback';

const episode = { id: 'ep-1', show_id: 'show-1' };

const mockRoutes = (frame) => {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.endsWith('/frame')) return { data: frame };
    if (url.includes('/missions')) return { data: { missions: [] } };
    return { data: { data: [{ id: 'home', category: 'phone', generated: true, url: 'https://x/home.png' }] } };
  });
};

describe('usePhonePlayback skin (Task #1964)', () => {
  beforeEach(() => vi.clearAllMocks());

  test('the Episode preview uses the skin saved for the show', async () => {
    mockRoutes({ success: true, frame_url: null, global_fit: null, phone_skin: 'midnight' });
    const { result } = renderHook(() => usePhonePlayback(episode));
    await act(async () => { await result.current.start(); });
    expect(api.get).toHaveBeenCalledWith('/api/v1/ui-overlays/show-1/frame');
    expect(result.current.skin).toBe('midnight');
  });

  test('falls back to rosegold when no skin is saved', async () => {
    mockRoutes({ success: true, frame_url: null, global_fit: null, phone_skin: null });
    const { result } = renderHook(() => usePhonePlayback(episode));
    await act(async () => { await result.current.start(); });
    expect(result.current.skin).toBe('rosegold');
  });
});

// Play used to fail silently (Evoni, 2026-10-07): it says why now.
describe('usePhonePlayback errors', () => {
  beforeEach(() => vi.clearAllMocks());

  test('no screen with an image: Play says so and does not open', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url.includes('/frame') || url.includes('/missions'))
      ? { data: {} }
      : { data: { data: [{ id: 'icon', category: 'phone_icon', generated: true, url: 'https://x/i.png' }] } });
    const { result } = renderHook(() => usePhonePlayback(episode));
    await act(async () => { await result.current.start(); });
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.error).toBe("No phone screens have an image yet. Make them in Producer Mode → Lala's Phone.");
  });

  test('a failed read says the phone did not open, and why', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { data: { error: 'show not found' } } });
    const { result } = renderHook(() => usePhonePlayback(episode));
    await act(async () => { await result.current.start(); });
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.error).toBe("The phone didn't open: show not found.");
  });

  test('icons stay in the list, for the phone to draw on screens', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url.includes('/frame') || url.includes('/missions'))
      ? { data: {} }
      : { data: { data: [
        { id: 'home', category: 'phone', generated: true, url: 'https://x/h.png' },
        { id: 'icon', category: 'phone_icon', generated: true, url: 'https://x/i.png' },
      ] } });
    const { result } = renderHook(() => usePhonePlayback(episode));
    await act(async () => { await result.current.start(); });
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.overlays.map((o) => o.id)).toEqual(['home', 'icon']);
  });
});
