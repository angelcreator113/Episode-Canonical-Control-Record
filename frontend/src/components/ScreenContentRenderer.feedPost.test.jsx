/**
 * The One Post zone (the Feed project, step 3, 2026-10-04) draws one
 * stored post live by id, marks a draft, and asks for a post when none is
 * picked.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import { SinglePostRenderer, CONTENT_TYPES } from './ScreenContentRenderer';

const POST = { id: 'p-1', status: 'live', poster_handle: 'marcus.k', poster_display_name: 'Marcus', content_text: 'That gala look though', likes: 120, comments_count: 2, sample_comments: ['iconic', 'who styled this'] };

beforeEach(() => { vi.mocked(api.get).mockReset(); });

describe('One Post zone', () => {
  test('is a registered social zone type', () => {
    expect(CONTENT_TYPES.find((t) => t.key === 'feed_post')).toMatchObject({ label: 'One Post', group: 'social' });
  });
  test('fetches the post by id and draws it live', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: POST } });
    render(<SinglePostRenderer config={{ post_id: 'p-1' }} />);
    const zone = await screen.findByTestId('feed-post-zone');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts/post/p-1');
    expect(zone.textContent).toContain('Marcus');
    expect(zone.textContent).toContain('@marcus.k');
    expect(zone.textContent).toContain('That gala look though');
    expect(zone.textContent).toContain('120');
    expect(zone.textContent).toContain('iconic');
    expect(zone.textContent).not.toContain('DRAFT');
  });
  test('marks a draft; asks for a post when none is picked; says when it is gone', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...POST, status: 'draft' } } });
    render(<SinglePostRenderer config={{ post_id: 'p-1' }} />);
    expect((await screen.findByTestId('feed-post-zone')).textContent).toContain('DRAFT');
    const { container } = render(<SinglePostRenderer config={{}} />);
    expect(container.textContent).toContain('Pick a post');
    vi.mocked(api.get).mockRejectedValue(new Error('404'));
    const gone = render(<SinglePostRenderer config={{ post_id: 'p-x' }} />);
    await screen.findByText('Post not found', {}, { container: gone.container });
  });
});
