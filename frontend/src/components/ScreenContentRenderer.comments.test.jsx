/**
 * The phone's Comments zone reads comment records (docs/FEED_POSTS.md
 * rule 6, 2026-10-04): one post's when the zone names a post, the
 * episode's posts' in an episode, the show's live posts' otherwise; a
 * post with no records falls back to its sample strings.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { commentsFrom } from './ScreenContentRenderer';

const POSTS = [
  { id: 'p1', comments: [{ id: 'c1', handle: 'marcus.k', display_name: 'Marcus', text: 'iconic' }, { id: 'c2', handle: 'rival', text: 'bold' }], sample_comments: ['ignored string'] },
  { id: 'p2', comments: [], sample_comments: ['legacy one', { handle: 'fan', text: 'legacy two' }] },
];
const zone = (config = {}) => ({ id: 'z1', content_type: 'comments_list', content_config: config, x: 0, y: 0, width: 100, height: 100 });

beforeEach(() => { vi.mocked(api.get).mockReset(); });

describe('commentsFrom', () => {
  test('records first (named by display name or handle), sample strings only where a post has none, capped', () => {
    const out = commentsFrom(POSTS, 3);
    expect(out.map((c) => [c.handle, c.text])).toEqual([['Marcus', 'iconic'], ['rival', 'bold'], [undefined, 'legacy one']]);
    expect(commentsFrom(POSTS, 10)).toHaveLength(4);
  });
});

describe('Comments zone', () => {
  test('in a show it reads the live posts with their comments', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: POSTS } });
    render(<ScreenContentRenderer zones={[zone()]} showId="s-1" />);
    expect(await screen.findByText('iconic')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts?show_id=s-1&with=comments&limit=20');
    expect(screen.getByText('Marcus')).toBeTruthy();
  });
  test('in an episode it reads that episode\'s posts, drafts included', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: POSTS } });
    render(<ScreenContentRenderer zones={[zone()]} showId="s-1" episodeId="ep-1" />);
    await screen.findByText('iconic');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts?episode_id=ep-1&status=all&with=comments&limit=20');
  });
  test('named post: that post\'s comments only; nothing yet reads "No comments"', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: POSTS[0] } });
    render(<ScreenContentRenderer zones={[zone({ post_id: 'p1', max_items: 1 })]} showId="s-1" />);
    await screen.findByText('iconic');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts/post/p1');
    expect(screen.queryByText('bold')).toBeNull();
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    render(<ScreenContentRenderer zones={[zone()]} showId="s-2" />);
    await screen.findByText('No comments');
  });
});
