/**
 * Social Media (the Feed project; the 2009 wall, 2026-10-04): the Home tab
 * is Lala's wall for the active show (her profile, status and friends on
 * the left; the live posts with their comments in the middle; requests,
 * upcoming events and people she may know on the right); Drafts and Events
 * are wall tabs; "What's on your mind?" posts as Lala, live; the banner
 * search narrows the wall; the old profile generator is the Friends tab,
 * which the old ?layer= links still open.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('./SocialProfileGenerator', () => ({
  default: ({ defaultFeedLayer, embedded }) => <div data-testid="people">people layer={defaultFeedLayer || 'none'} embedded={String(embedded)}</div>,
}));

import api from '../services/api';
import SocialMediaPage, { tabFromParams, posterOf, whenLabel, eventWhen } from './SocialMediaPage';

const SHOW = { id: '7b1d2c3e-4f50-4a61-8b72-93c4d5e6f708', name: 'Styling Adventures with Lala' };
const LALA = { id: 1, handle: 'lala', display_name: 'Lala', city: 'dazzle_district', relationship_status: "it's complicated", follower_count_approx: '12k' };
const PEOPLE = [LALA, { id: 2, handle: 'marcus.k', display_name: 'Marcus' }, { id: 3, handle: 'rival', display_name: 'The Rival' }, { id: 4, handle: 'bestie', display_name: 'Bestie' }, { id: 5, handle: 'p5', display_name: 'P5' }, { id: 6, handle: 'p6', display_name: 'P6' }, { id: 7, handle: 'p7', display_name: 'P7' }, { id: 8, handle: 'p8', display_name: 'P8' }, { id: 9, handle: 'p9', display_name: 'P9' }];
const POSTS = [
  { id: 'p1', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'is deciding between the gold heels and the ones that actually let me walk.', likes: 3, comments_count: 1, status: 'live', posted_at: new Date(Date.now() - 2 * 3600000).toISOString(), comments: [{ id: 'c1', handle: 'marcus.k', display_name: 'Marcus', text: 'which part, the jacket or the person I was with' }] },
  { id: 'p2', poster_handle: 'rival', poster_display_name: 'The Rival', content_text: 'Some people peak early.', likes: 0, status: 'live', narrative_function: 'shade', episode_id: 'ep-1', socialProfile: null, comments: [] },
];
const EVENTS = [{ id: 'e1', title: 'Dazzle Gala', location_name: 'Dazzle District', start_datetime: new Date(Date.now() + 86400000).toISOString() }];
const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><SocialMediaPage /></MemoryRouter>);

let drafts;
let posts;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  posts = [...POSTS];
  drafts = [{ id: 'd1', poster_handle: 'lala', content_text: 'Not yet.', status: 'draft', episode_id: 'ep-2', comments: [] }];
  vi.mocked(api.get).mockImplementation(async (url) => {
    const u = new URL(url, 'http://x');
    if (url.includes('/shows')) return { data: { data: [SHOW] } };
    if (url.includes('/social-profiles')) {
      const list = u.searchParams.get('search') === 'lala' ? [LALA] : PEOPLE;
      return { data: { profiles: list, pagination: { total: list.length } } };
    }
    if (url.includes('/calendar/events')) return { data: { events: EVENTS } };
    if (url.includes('/comments/pending')) return { data: { data: [{ id: 'c9', handle: 'rival', text: 'cute.', post: { poster_handle: 'lala' } }], count: 1 } };
    if (url.includes('/feed-posts')) {
      const data = u.searchParams.get('status') === 'draft' ? drafts : posts;
      return { data: { data, total: data.length, hasMore: false } };
    }
    return { data: {} };
  });
  vi.mocked(api.post).mockImplementation(async (url, body) => {
    const post = { id: 'p3', post_type: body.post_type || 'post', poster_handle: body.poster_handle, poster_display_name: body.poster_display_name, content_text: body.content_text, status: 'live', posted_at: new Date().toISOString(), comments: [] };
    posts.unshift(post);
    return { data: { data: post } };
  });
});

describe('helpers', () => {
  test('tabFromParams: Home by default; an old ?layer= or ?profile= link opens Friends', () => {
    expect(tabFromParams(new URLSearchParams(''))).toBe('posts');
    expect(tabFromParams(new URLSearchParams('tab=people'))).toBe('people');
    expect(tabFromParams(new URLSearchParams('layer=lalaverse'))).toBe('people');
    expect(tabFromParams(new URLSearchParams('profile=12&layer=real_world'))).toBe('people');
  });
  test('posterOf reads the post, else its profile; whenLabel speaks 2009', () => {
    expect(posterOf(POSTS[0])).toEqual({ name: 'Lala', handle: 'lala', platform: '' });
    expect(posterOf({ socialProfile: { handle: 'r', display_name: 'R', platform: 'tiktok' } })).toEqual({ name: 'R', handle: 'r', platform: 'tiktok' });
    const now = new Date('2026-10-04T15:00:00');
    expect(whenLabel(new Date('2026-10-04T14:59:30'), now)).toBe('Just now');
    expect(whenLabel(new Date('2026-10-04T14:20:00'), now)).toBe('40 minutes ago');
    expect(whenLabel(new Date('2026-10-04T09:05:00'), now)).toMatch(/^Today at 9:05/);
    expect(whenLabel(new Date('2026-10-03T23:42:00'), now)).toMatch(/^Yesterday at 11:42/);
    expect(whenLabel(new Date('2026-09-30T09:02:00'), now)).toMatch(/^Wednesday at 9:02/);
    expect(whenLabel(null)).toBeNull();
    expect(eventWhen(new Date('2026-10-06T02:33:00'))).toMatch(/^Tue, Oct 6, 2:33am$/);
    expect(eventWhen(null)).toBe('[Day], [time]');
  });
});

describe('the wall', () => {
  test('Lala\'s profile, status, friends, the live posts with comments, requests, events, people she may know', async () => {
    renderAt('/feed');
    expect(screen.getByText('lalaverse')).toBeTruthy();
    const items = await screen.findAllByTestId('sm-post');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Lala is deciding between the gold heels');
    expect(items[0].textContent).toContain('[3] like this.');
    expect(items[0].textContent).toContain('Marcus which part, the jacket');
    expect(items[1].querySelector('a[href="/episodes/ep-1"]')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Lala' })).toBeTruthy();
    expect(screen.getByTestId('sm-status').textContent).toContain('is deciding between the gold heels');
    expect(screen.getByTestId('sm-info').textContent).toContain('Dazzle District');
    expect(screen.getByTestId('sm-info').textContent).toContain("it's complicated");
    expect(screen.getByTestId('sm-friends').textContent).toContain('[9] friends');
    expect(screen.getByTestId('sm-friends').textContent).toContain('Marcus');
    expect(screen.getByTestId('sm-requests').textContent).toContain('1 draft post');
    expect(screen.getByTestId('sm-requests').textContent).toContain('1 reaction to approve');
    expect(screen.getByTestId('sm-upcoming').textContent).toContain('Dazzle Gala');
    expect(screen.getByTestId('sm-may-know').textContent).toContain('P8');
    expect(screen.getByRole('button', { name: 'Inbox (2)' })).toBeTruthy();
    expect(screen.getByTestId('sm-count').textContent).toBe('2 posts · Styling Adventures with Lala');
    const url = api.get.mock.calls.find((c) => c[0].includes('/feed-posts?'))[0];
    expect(url).toContain(`show_id=${SHOW.id}`);
    expect(url).toContain('status=live');
    expect(url).toContain('with=comments');
  });

  test('Drafts asks for drafts and marks them; Events lists the upcoming; search narrows the wall', async () => {
    renderAt('/feed');
    await screen.findAllByTestId('sm-post');
    fireEvent.click(screen.getByRole('button', { name: 'Inbox (2)' }));
    await waitFor(() => expect(screen.getAllByTestId('sm-post')).toHaveLength(1));
    expect(screen.getByTestId('sm-post').textContent).toMatch(/draft/i);
    expect(api.get.mock.calls.some((c) => c[0].includes('status=draft') && c[0].includes('with=comments'))).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: 'Events' }));
    expect((await screen.findByTestId('sm-events')).textContent).toContain('Dazzle Gala');
    fireEvent.click(screen.getByRole('tab', { name: 'Wall' }));
    await waitFor(() => expect(screen.getAllByTestId('sm-post')).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Search posts'), { target: { value: 'rival' } });
    expect(screen.getAllByTestId('sm-post')).toHaveLength(1);
  });

  test('"What\'s on your mind?" posts as Lala, live, and the wall shows it', async () => {
    renderAt('/feed');
    await screen.findAllByTestId('sm-post');
    fireEvent.change(screen.getByLabelText("What's on your mind?"), { target: { value: 'is not doing this again.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts', expect.objectContaining({ show_id: SHOW.id, content_text: 'is not doing this again.', poster_handle: 'lala', social_profile_id: 1, status: 'live' })));
    await waitFor(() => expect(screen.getAllByTestId('sm-post')[0].textContent).toContain('is not doing this again.'));
  });

  test('Relationship shares a relationship post; the Info box reads the newest one', async () => {
    renderAt('/feed');
    await screen.findAllByTestId('sm-post');
    expect(screen.getByTestId('sm-rel-status').textContent).toBe("it's complicated");
    fireEvent.click(screen.getByLabelText('Relationship'));
    fireEvent.click(screen.getByRole('button', { name: 'Single' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts', expect.objectContaining({
      show_id: SHOW.id, post_type: 'relationship', content_text: 'changed her relationship status to "Single."', poster_handle: 'lala', status: 'live',
    })));
    await waitFor(() => expect(screen.getByTestId('sm-rel-status').textContent).toBe('Single'));
  });

  test('Friends shares "and X are now friends." with the picked friend', async () => {
    renderAt('/feed');
    await screen.findAllByTestId('sm-post');
    fireEvent.click(screen.getByLabelText('Friends'));
    expect(screen.getByRole('button', { name: 'Share' }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Now friends with'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts', expect.objectContaining({ post_type: 'relationship', content_text: 'and Marcus are now friends.' })));
  });

  test('an empty wall says what to do; no posts, no crash on missing sides', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url.includes('/shows') ? { data: { data: [SHOW] } } : { data: { data: [], total: 0, hasMore: false } }));
    renderAt('/feed');
    expect((await screen.findByTestId('sm-empty')).textContent).toContain('Nothing on the wall yet');
    expect(screen.getByRole('heading', { name: 'Lala' })).toBeTruthy();
  });

  test('Friends embeds the profile generator; the old ?layer=lalaverse link lands there', async () => {
    renderAt('/feed?layer=lalaverse');
    expect((await screen.findByTestId('people')).textContent).toBe('people layer=lalaverse embedded=true');
    expect(screen.queryByTestId('sm-post')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Home' }));
    await screen.findAllByTestId('sm-post');
  });
});
