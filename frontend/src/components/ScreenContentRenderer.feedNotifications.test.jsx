/**
 * The phone's Feed Notifications zone (docs/FEED_POSTS.md rule 7,
 * 2026-10-04) derives "X commented on your status" and "X posted" from
 * the feed records, newest first; never from copied text.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { notificationsFrom, CONTENT_TYPES } from './ScreenContentRenderer';

const POSTS = [
  { id: 'p1', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'is not doing this again.', posted_at: '2026-10-04T10:00:00Z',
    comments: [{ id: 'c1', handle: 'marcus.k', display_name: 'Marcus', text: 'call me', posted_at: '2026-10-04T12:00:00Z' }, { id: 'c2', handle: 'lala', text: 'no', posted_at: '2026-10-04T12:30:00Z' }] },
  { id: 'p2', poster_handle: 'rival', poster_display_name: 'The Rival', content_text: 'Some people peak early.', posted_at: '2026-10-04T11:00:00Z', comments: [] },
  { id: 'p3', poster_handle: 'marcus.k', poster_display_name: 'Marcus', content_text: "saw you at Radiance Row, Lala. we need to talk.", posted_at: '2026-10-04T09:00:00Z', comments: [{ id: 'c3', handle: 'rival', display_name: 'The Rival', text: 'oh?', posted_at: '2026-10-04T09:30:00Z' }] },
];
const zone = (config = {}) => ({ id: 'z1', content_type: 'feed_notifications', content_config: config, x: 0, y: 0, width: 100, height: 100 });

beforeEach(() => { vi.mocked(api.get).mockReset(); });

describe('notificationsFrom', () => {
  test('comments on Lala\'s posts, others\' posts and comments, newest first, never Lala\'s own comments', () => {
    const out = notificationsFrom(POSTS, { max: 10 });
    expect(out.map((n) => `${n.who} ${n.text}`)).toEqual([
      'Marcus commented on your status: “call me”',
      'The Rival posted: “Some people peak early.”',
      'The Rival commented on Marcus\'s post: “oh?”',
      'Marcus wrote on your wall: “saw you at Radiance Row, Lala. we need to talk.”',
    ]);
    expect(notificationsFrom(POSTS, { max: 2 })).toHaveLength(2);
    expect(notificationsFrom(POSTS, { ownerHandle: 'rival', max: 10 })[0].text).toMatch(/^commented on Lala's post/);
  });
  test('is a registered messages zone', () => {
    expect(CONTENT_TYPES.find((t) => t.key === 'feed_notifications')).toMatchObject({ group: 'messages' });
  });
});

describe('Feed Notifications zone', () => {
  test('reads the show\'s live posts with comments and shows the newest', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: POSTS } });
    render(<ScreenContentRenderer zones={[zone({ max_items: 2 })]} showId="s-1" />);
    const z = await screen.findByTestId('feed-notifications-zone');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts?show_id=s-1&with=comments&limit=30');
    expect(z.textContent).toContain('Marcus commented on your status: “call me”');
    expect(z.textContent).toContain('The Rival posted');
    expect(z.textContent).not.toContain('wrote on your wall');
  });
  test('in an episode it reads that episode\'s posts; nothing reads "No notifications"', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    render(<ScreenContentRenderer zones={[zone()]} showId="s-1" episodeId="ep-1" />);
    await screen.findByText('No notifications');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts?episode_id=ep-1&status=all&with=comments&limit=30');
  });
});
