/**
 * The Pulse zone on Lala's Phone (Task 2986; The Pulse spec §3 "Phone sync"):
 * it reads The Pulse with the same request as The Pulse and its Story clock,
 * as of the beat's story order, a zone's own pinned order, or the present.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { PulseFeedRenderer, CONTENT_TYPES } from './ScreenContentRenderer';
import { pulseFeedUrl } from '../lib/pulsePosts';

const POSTS = [
  { id: 'p1', poster_display_name: 'Marcus', poster_handle: 'marcus.k', content_text: 'the gala though', likes: 12400, comments_count: 3 },
  { id: 'p2', poster_handle: 'nia', content_text: 'who styled her', likes: 80, comments_count: 0 },
];

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockResolvedValue({ data: { data: POSTS, total: 2 } });
});

describe('The Pulse zone', () => {
  test('is a registered social zone type', () => {
    expect(CONTENT_TYPES.find((t) => t.key === 'pulse_feed')).toMatchObject({ label: 'The Pulse', group: 'social' });
  });

  test("reads The Pulse at the beat's story order, the same request as The Pulse's Story clock", async () => {
    render(<PulseFeedRenderer showId="show-1" storyAt={15} />);
    const zone = await screen.findByTestId('pulse-feed-zone');
    expect(api.get).toHaveBeenCalledWith(pulseFeedUrl('show-1', 15, 5));
    expect(api.get.mock.calls[0][0]).toBe('/api/v1/feed-posts?show_id=show-1&status=live&with=comments&limit=5&at=15');
    expect(zone.textContent).toContain('The Pulse · During Ep 1');
    const posts = screen.getAllByTestId('pulse-feed-post');
    expect(posts).toHaveLength(2);
    expect(posts[0].textContent).toContain('Marcus');
    expect(posts[0].textContent).toContain('12,400');
    expect(posts[1].textContent).toContain('nia');
  });

  test("a zone's own order wins; without a beat it reads the present; max_items limits it", async () => {
    render(<PulseFeedRenderer showId="show-1" storyAt={15} config={{ at: 27, max_items: 1 }} />);
    await screen.findByTestId('pulse-feed-zone');
    expect(api.get).toHaveBeenLastCalledWith('/api/v1/feed-posts?show_id=show-1&status=live&with=comments&limit=1&at=27');
    expect(screen.getAllByTestId('pulse-feed-post')).toHaveLength(1);
    render(<PulseFeedRenderer showId="show-1" />);
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/v1/feed-posts?show_id=show-1&status=live&with=comments&limit=5&at=present'));
  });

  test('nothing yet says so', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    render(<PulseFeedRenderer showId="show-1" storyAt={15} />);
    expect(await screen.findByText('Nothing on The Pulse yet')).toBeTruthy();
  });

  test('ScreenContentRenderer passes the beat order through to a Pulse zone', async () => {
    render(<div style={{ position: 'relative' }}><ScreenContentRenderer showId="show-1" storyAt={35}
      zones={[{ id: 'z1', x: 0, y: 10, w: 100, h: 80, content_type: 'pulse_feed', content_config: {} }]} /></div>);
    await screen.findByTestId('pulse-feed-zone');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts?show_id=show-1&status=live&with=comments&limit=5&at=35');
  });
});
