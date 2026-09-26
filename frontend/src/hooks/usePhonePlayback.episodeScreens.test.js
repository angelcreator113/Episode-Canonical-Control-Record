import { vi, describe, beforeEach, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('./usePhonePlaythrough', () => ({ default: () => null }));

import api from '../services/api';
import usePhonePlayback from './usePhonePlayback';

describe('usePhonePlayback plays the episode\'s screens (Task #1920)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('/missions')) return { data: { missions: [] } };
      if (url.endsWith('/frame')) return { data: {} };
      return { data: { data: [
        { id: 'camera', name: 'Camera', generated: true, url: 'https://x/cam-ep.png', is_episode_override: true },
      ] } };
    });
  });

  test('the overlay request is scoped to the episode, as the Lala\'s Phone tab\'s is', async () => {
    const { result } = renderHook(() => usePhonePlayback({ id: 'ep-1', show_id: 's-1' }));
    await act(async () => { await result.current.start(); });
    expect(api.get).toHaveBeenCalledWith('/api/v1/ui-overlays/s-1?episode_id=ep-1');
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/ui-overlays/s-1');
    expect(result.current.overlays.map((o) => o.url)).toEqual(['https://x/cam-ep.png']);
  });
});
