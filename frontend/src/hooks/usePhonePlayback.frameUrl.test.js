import { vi, describe, beforeEach, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('./usePhonePlaythrough', () => ({ default: () => null }));

import api from '../services/api';
import usePhonePlayback from './usePhonePlayback';

function mockFrame(frameData) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.includes('/missions')) return { data: { missions: [] } };
    if (url.endsWith('/frame')) return { data: frameData };
    return { data: { data: [{ id: 'home', name: 'Home', generated: true, url: 'https://x/home.png' }] } };
  });
}

describe('usePhonePlayback exposes the custom frame (Task #1990)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('frameUrl comes from the same GET /frame response as the skin', async () => {
    mockFrame({ frame_url: 'https://x/frame.png', phone_skin: 'lavender' });
    const { result } = renderHook(() => usePhonePlayback({ id: 'ep-1', show_id: 's-1' }));
    expect(result.current.frameUrl).toBeNull();
    await act(async () => { await result.current.start(); });
    expect(result.current.frameUrl).toBe('https://x/frame.png');
    expect(result.current.skin).toBe('lavender');
  });

  test('no custom frame leaves frameUrl null', async () => {
    mockFrame({ frame_url: null });
    const { result } = renderHook(() => usePhonePlayback({ id: 'ep-1', show_id: 's-1' }));
    await act(async () => { await result.current.start(); });
    expect(result.current.frameUrl).toBeNull();
  });
});
