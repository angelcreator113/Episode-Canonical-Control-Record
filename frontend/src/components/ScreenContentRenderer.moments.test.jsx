/**
 * Phone round step 1, D5 (Evoni, 2026-10-25): the DM and notification zones
 * read the episode's phone moments once between them, and a failed read
 * says "Couldn't load messages", not "No DMs".
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { refreshEpisodeMoments } from './ScreenContentRenderer';

const URL1 = '/api/v1/feed-enhanced/s-1/moments/ep-1';
const MOMENTS = [
  { id: 'm1', phone_screen_type: 'dm', trigger_handle: 'marcus.k', screen_content: 'we need to talk' },
  { id: 'm2', phone_screen_type: 'notification', trigger_handle: 'rival', screen_content: 'liked your post' },
];
const zone = (id, type) => ({ id, content_type: type, content_config: {}, x: 0, y: 0, w: 100, h: 50 });
const ZONES = [zone('z-dm', 'dm_thread'), zone('z-n', 'notifications')];

beforeEach(() => { vi.mocked(api.get).mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('the episode moments zones', () => {
  test('the DM and notification zones share one read', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: MOMENTS } });
    render(<ScreenContentRenderer zones={ZONES} showId="s-1" episodeId="ep-1" />);
    expect(await screen.findByText('we need to talk')).toBeTruthy();
    expect(await screen.findByText('rival')).toBeTruthy();
    expect(vi.mocked(api.get).mock.calls.filter(([u]) => u === URL1)).toHaveLength(1);
  });

  test('a failed read says so in both zones, and is logged', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(Object.assign(new Error('boom'), { response: { data: { error: 'Server error' } } }));
    render(<ScreenContentRenderer zones={ZONES} showId="s-1" episodeId="ep-1" />);
    expect(await screen.findByText("Couldn't load messages")).toBeTruthy();
    expect(screen.getByText("Couldn't load notifications")).toBeTruthy();
    expect(screen.queryByText('No DMs')).toBeNull();
    expect(err).toHaveBeenCalledWith('[ScreenContentRenderer] read failed:', URL1, expect.any(Error));
  });

  test('none is still "No DMs"', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    render(<ScreenContentRenderer zones={[zone('z-dm', 'dm_thread')]} showId="s-1" episodeId="ep-1" />);
    expect(await screen.findByText('No DMs')).toBeTruthy();
  });

  test('another episode, or the screen opened again, reads fresh; a refresh re-reads', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: MOMENTS } });
    const { rerender, unmount } = render(<ScreenContentRenderer zones={ZONES} showId="s-1" episodeId="ep-1" />);
    await screen.findByText('we need to talk');
    rerender(<ScreenContentRenderer zones={ZONES} showId="s-1" episodeId="ep-2" />);
    await screen.findByText('we need to talk');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-enhanced/s-1/moments/ep-2');
    unmount();
    render(<ScreenContentRenderer zones={ZONES} showId="s-1" episodeId="ep-1" />);
    await screen.findByText('we need to talk');
    expect(vi.mocked(api.get).mock.calls.filter(([u]) => u === URL1)).toHaveLength(2);
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ ...MOMENTS[0], screen_content: 'call me back' }] } });
    await act(async () => { await refreshEpisodeMoments('s-1', 'ep-1'); });
    expect(await screen.findByText('call me back')).toBeTruthy();
    expect(refreshEpisodeMoments('s-1', 'ep-9')).toBeNull();
  });
});
