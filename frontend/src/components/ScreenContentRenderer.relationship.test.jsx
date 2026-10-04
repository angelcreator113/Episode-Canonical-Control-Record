/**
 * The phone's Relationship Changes zone (docs/FEED_POSTS.md rule 8,
 * 2026-10-04) draws relationship posts live, a draft marked.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { CONTENT_TYPES } from './ScreenContentRenderer';

const POSTS = [
  { id: 'r1', post_type: 'relationship', poster_handle: 'marcus.k', poster_display_name: '[Friend]', content_text: 'changed her relationship status to "It\'s complicated."', likes: 4, comments_count: 9, status: 'live' },
  { id: 'r2', post_type: 'relationship', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'and Marcus are now friends.', status: 'draft' },
];
const zone = (config = {}) => ({ id: 'z1', content_type: 'relationship_changes', content_config: config, x: 0, y: 0, width: 100, height: 100 });

beforeEach(() => { vi.mocked(api.get).mockReset(); });

describe('Relationship Changes zone', () => {
  test('is a registered social zone', () => {
    expect(CONTENT_TYPES.find((t) => t.key === 'relationship_changes')).toMatchObject({ label: 'Relationship Changes', group: 'social' });
  });
  test('reads the show\'s live relationship posts and draws them with their counts', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [POSTS[0]] } });
    render(<ScreenContentRenderer zones={[zone()]} showId="s-1" />);
    const z = await screen.findByTestId('relationship-changes-zone');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts?show_id=s-1&post_type=relationship&with=comments&limit=3');
    expect(z.textContent).toContain('[Friend] changed her relationship status to "It\'s complicated."');
    expect(z.textContent).toContain('9');
    expect(z.textContent).not.toContain('DRAFT');
  });
  test('in an episode it reads that episode\'s, drafts marked; none reads "No relationship news"', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: POSTS } });
    render(<ScreenContentRenderer zones={[zone({ max_items: 2 })]} showId="s-1" episodeId="ep-1" />);
    const z = await screen.findByTestId('relationship-changes-zone');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts?episode_id=ep-1&status=all&post_type=relationship&with=comments&limit=2');
    expect(z.textContent).toContain('Lala and Marcus are now friends.');
    expect(z.textContent).toContain('DRAFT');
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'x', post_type: 'post', content_text: 'hi' }] } });
    render(<ScreenContentRenderer zones={[zone()]} showId="s-2" />);
    await screen.findByText('No relationship news');
  });
});
