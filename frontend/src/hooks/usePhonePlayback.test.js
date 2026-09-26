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
    return { data: { data: [] } };
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
