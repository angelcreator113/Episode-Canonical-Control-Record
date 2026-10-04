/**
 * Social Media (2026-10-04, the Feed project, step 1): the sidebar's
 * social page shows the stored posts for the active show by default,
 * filters them by what they do, and keeps the old profile generator as
 * the People tab, which the old ?layer= links still open.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('./SocialProfileGenerator', () => ({
  default: ({ defaultFeedLayer, embedded }) => <div data-testid="people">people layer={defaultFeedLayer || 'none'} embedded={String(embedded)}</div>,
}));

import api from '../services/api';
import SocialMediaPage, { tabFromParams, posterOf } from './SocialMediaPage';

const SHOW = { id: '7b1d2c3e-4f50-4a61-8b72-93c4d5e6f708', name: 'Styling Adventures with Lala' };
const POSTS = [
  { id: 'p1', poster_handle: 'marcus.k', poster_display_name: 'Marcus', poster_platform: 'instagram', content_text: 'That gala look though', likes: 120, comments_count: 3, sample_comments: ['iconic', 'who styled this'], narrative_function: 'support', posted_at: '2026-09-01T10:00:00Z', episode_id: 'ep-1', socialProfile: null },
  { id: 'p2', poster_handle: null, poster_display_name: null, content_text: 'Some people peak early.', likes: 4, narrative_function: 'shade', socialProfile: { handle: 'rival', display_name: 'The Rival', platform: 'tiktok' } },
];
const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><SocialMediaPage /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.includes('/shows')) return { data: { data: [SHOW] } };
    if (url.includes('/feed-posts')) {
      const fn = new URL(url, 'http://x').searchParams.get('narrative_function');
      const data = fn ? POSTS.filter((p) => p.narrative_function === fn) : POSTS;
      return { data: { data, total: data.length, hasMore: false } };
    }
    return { data: {} };
  });
});

describe('tabFromParams and posterOf', () => {
  test('Posts by default; an old ?layer= or ?profile= link opens People', () => {
    expect(tabFromParams(new URLSearchParams(''))).toBe('posts');
    expect(tabFromParams(new URLSearchParams('tab=people'))).toBe('people');
    expect(tabFromParams(new URLSearchParams('layer=lalaverse'))).toBe('people');
    expect(tabFromParams(new URLSearchParams('profile=12&layer=real_world'))).toBe('people');
    expect(tabFromParams(new URLSearchParams('tab=nope'))).toBe('posts');
  });
  test('the poster comes from the post, else its profile', () => {
    expect(posterOf(POSTS[0])).toEqual({ name: 'Marcus', handle: 'marcus.k', platform: 'instagram' });
    expect(posterOf(POSTS[1])).toEqual({ name: 'The Rival', handle: 'rival', platform: 'tiktok' });
  });
});

describe('Social Media page', () => {
  test('shows the active show\'s posts with poster, text, counts and comments', async () => {
    renderAt('/feed');
    expect(screen.getByRole('heading', { name: 'Social Media' })).toBeTruthy();
    const cards = await screen.findAllByTestId('sm-post');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Marcus');
    expect(cards[0].textContent).toContain('@marcus.k');
    expect(cards[0].textContent).toContain('That gala look though');
    expect(cards[0].textContent).toContain('♥ 120');
    expect(cards[0].textContent).toContain('iconic');
    expect(cards[0].querySelector('a[href="/episodes/ep-1"]')).toBeTruthy();
    expect(cards[1].textContent).toContain('The Rival');
    expect(screen.getByTestId('sm-count').textContent).toBe('2 posts · Styling Adventures with Lala');
    const url = api.get.mock.calls.find((c) => c[0].includes('/feed-posts'))[0];
    expect(url).toContain(`show_id=${SHOW.id}`);
  });

  test('a function chip asks the API for that function; search narrows by text and poster', async () => {
    renderAt('/feed');
    await screen.findAllByTestId('sm-post');
    fireEvent.click(screen.getByRole('button', { name: 'shade' }));
    await waitFor(() => expect(screen.getAllByTestId('sm-post')).toHaveLength(1));
    expect(api.get.mock.calls.some((c) => c[0].includes('narrative_function=shade'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(screen.getAllByTestId('sm-post')).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Search posts'), { target: { value: 'rival' } });
    expect(screen.getAllByTestId('sm-post')).toHaveLength(1);
  });

  test('no posts: an empty state that says where posts come from', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (
      url.includes('/shows') ? { data: { data: [SHOW] } } : { data: { data: [], total: 0, hasMore: false } }
    ));
    renderAt('/feed');
    expect((await screen.findByTestId('sm-empty')).textContent).toContain('No posts yet');
  });

  test('People embeds the profile generator; the old ?layer=lalaverse link lands there', async () => {
    renderAt('/feed?layer=lalaverse');
    expect((await screen.findByTestId('people')).textContent).toBe('people layer=lalaverse embedded=true');
    expect(screen.queryByTestId('sm-post')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Posts/ }));
    await screen.findAllByTestId('sm-post');
  });
});
