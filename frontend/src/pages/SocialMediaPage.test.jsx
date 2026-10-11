/**
 * Social Media (the Feed project; the 2009 wall, 2026-10-04): the Home tab
 * is Lala's wall for the active show (her profile, status and friends on
 * the left; the live posts with their comments in the middle; requests,
 * upcoming events and people she may know on the right); Drafts and Events
 * are wall tabs; "What's on your mind?" saves Lala's draft, which Release
 * makes live (Task #2748); Deleted keeps deleted posts; the banner
 * search narrows the wall; the old profile generator is the Friends tab,
 * which the old ?layer= links still open.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('./SocialProfileGenerator', () => ({ // must never mount here (Task #2761)
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
let deleted;
let lalaColumn;
let relPosts;
beforeEach(() => {
  lalaColumn = {
    profile: LALA, portrait_url: null, home_city: 'Echo Park', career: { tier: 1, label: 'Emerging' },
    friends: { total: 2, list: [{ id: 2, handle: 'marcus.k', display_name: 'Marcus' }, { id: 4, handle: 'bestie', display_name: 'Bestie' }] },
  };
  relPosts = [];
  Object.values(api).forEach((fn) => fn.mockReset());
  posts = [...POSTS];
  deleted = [];
  drafts = [{ id: 'd1', poster_handle: 'lala', content_text: 'Not yet.', status: 'draft', episode_id: 'ep-2', comments: [] }];
  vi.mocked(api.get).mockImplementation(async (url) => {
    const u = new URL(url, 'http://x');
    if (url.includes('/shows')) return { data: { data: [SHOW] } };
    if (url.startsWith('/api/v1/social-profiles/lala?')) return { data: { data: lalaColumn } };
    if (url.includes('/social-profiles')) {
      const list = u.searchParams.get('search') === 'lala' ? [LALA] : PEOPLE;
      return { data: { profiles: list, pagination: { total: list.length } } };
    }
    if (url.includes('/calendar/events')) return { data: { events: EVENTS } };
    if (url.includes('/feed-posts/deleted')) return { data: { data: deleted, count: deleted.length } };
    if (url.includes('/comments/pending')) return { data: { data: [{ id: 'c9', handle: 'rival', text: 'cute.', post: { poster_handle: 'lala' } }], count: 1 } };
    if (url.includes('/feed-posts') && u.searchParams.get('post_type') === 'relationship') return { data: { data: relPosts, total: relPosts.length } };
    if (url.includes('/feed-posts')) {
      const data = u.searchParams.get('status') === 'draft' ? drafts : posts;
      return { data: { data, total: data.length, hasMore: false } };
    }
    return { data: {} };
  });
  vi.mocked(api.post).mockImplementation(async (url, body) => {
    const restore = url.match(/\/feed-posts\/(\w+)\/restore$/);
    if (restore) {
      const post = deleted.find((p) => p.id === restore[1]);
      deleted = deleted.filter((p) => p !== post);
      const back = { ...post, deleted_at: null };
      (back.status === 'draft' ? drafts : posts).unshift(back);
      return { data: { data: back } };
    }
    const live = body.status === 'live';
    const post = { id: 'p3', post_type: body.post_type || 'post', poster_handle: body.poster_handle, poster_display_name: body.poster_display_name, content_text: body.content_text, status: body.status, posted_at: live ? new Date().toISOString() : null, story_order: 7, comments: [] };
    (live ? posts : drafts).unshift(post);
    return { data: { data: post } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    const id = url.split('/').pop();
    const post = drafts.find((p) => p.id === id);
    Object.assign(post, body);
    if (body.status === 'live') { drafts = drafts.filter((p) => p !== post); post.posted_at = new Date().toISOString(); posts.unshift(post); }
    return { data: { data: post } };
  });
  vi.mocked(api.delete).mockImplementation(async (url) => {
    const id = url.split('/').pop();
    const post = drafts.find((p) => p.id === id);
    drafts = drafts.filter((p) => p !== post);
    deleted.unshift({ ...post, deleted_at: new Date().toISOString() });
    return { data: { success: true } };
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
    expect(screen.getByTestId('sm-info').textContent).toContain("it's complicated");
    await waitFor(() => expect(screen.getByTestId('sm-city').textContent).toBe('Echo Park'));
    expect(screen.getByTestId('sm-career').textContent).toBe('Emerging');
    expect(screen.getByTestId('sm-friends-count').textContent).toBe('2 friends');
    expect(screen.getAllByTestId('sm-friend').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['MMarcus', '/world-studio?tab=feed&layer=lalaverse&profile=2'], ['BBestie', '/world-studio?tab=feed&layer=lalaverse&profile=4'],
    ]);
    expect(api.get).toHaveBeenCalledWith(`/api/v1/social-profiles/lala?show_id=${SHOW.id}`);
    expect(document.body.textContent).not.toMatch(/\[City\]|\[Status\]|Styling, everywhere|\[\d+\] friends/);
    expect(screen.getByTestId('sm-requests').textContent).toContain('1 draft post');
    expect(screen.getByTestId('sm-requests').textContent).toContain('1 reaction to approve');
    expect(screen.getByTestId('sm-upcoming').textContent).toContain('Dazzle Gala');
    expect(screen.getByTestId('sm-may-know').textContent).toContain('P8');
    // The Inbox count reaches the page header through the wall's onInbox effect, one
    // render after the wall itself; wait for it rather than read it at once.
    expect(await screen.findByRole('button', { name: 'Inbox (2)' })).toBeTruthy();
    expect(screen.getByTestId('sm-count').textContent).toBe('2 posts · Styling Adventures with Lala');
    const url = api.get.mock.calls.find((c) => c[0].includes('/feed-posts?'))[0];
    expect(url).toContain(`show_id=${SHOW.id}`);
    expect(url).toContain('status=live');
    expect(url).toContain('with=comments');
  });

  test('Drafts asks for drafts and marks them; Events lists the upcoming; search narrows the wall', async () => {
    renderAt('/feed');
    await screen.findAllByTestId('sm-post');
    fireEvent.click(await screen.findByRole('button', { name: 'Inbox (2)' }));
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

  test('"What\'s on your mind?" saves a draft, not a live post; Release makes it live on the wall', async () => {
    renderAt('/feed');
    await screen.findAllByTestId('sm-post');
    expect(screen.getByText("Saves as a draft. Release it when it's time.")).toBeTruthy();
    expect(screen.queryByText(/live on the feed/)).toBeNull();
    fireEvent.change(screen.getByLabelText("What's on your mind?"), { target: { value: 'is not doing this again.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts', expect.objectContaining({ show_id: SHOW.id, content_text: 'is not doing this again.', poster_handle: 'lala', social_profile_id: 1, status: 'draft' })));
    // It lands on Drafts, and Requests counts it.
    await waitFor(() => expect(screen.getByRole('tab', { name: /Drafts/ }).getAttribute('aria-selected')).toBe('true'));
    await waitFor(() => expect(screen.getAllByTestId('sm-post')[0].textContent).toContain('is not doing this again.'));
    await waitFor(() => expect(screen.getByTestId('sm-requests').textContent).toContain('2 draft posts'));
    fireEvent.click(within(screen.getAllByTestId('sm-post')[0]).getByRole('button', { name: 'Release' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/p3', { status: 'live' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Wall' }));
    await waitFor(() => expect(screen.getAllByTestId('sm-post')[0].textContent).toContain('is not doing this again.'));
    expect(within(screen.getAllByTestId('sm-post')[0]).queryByRole('button', { name: 'Release' })).toBeNull();
  });

  test('a draft can be edited and deleted; Deleted keeps it and Restore brings it back', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('/feed?tab=posts');
    await screen.findAllByTestId('sm-post');
    fireEvent.click(screen.getByRole('tab', { name: /Drafts/ }));
    await waitFor(() => expect(screen.getAllByTestId('sm-post')[0].textContent).toContain('Not yet.'));
    const card = screen.getAllByTestId('sm-post')[0];
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    fireEvent.change(within(card).getByLabelText('Edit the draft'), { target: { value: 'Not yet. Soon.' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/d1', { content_text: 'Not yet. Soon.' }));
    await waitFor(() => expect(screen.getAllByTestId('sm-post')[0].textContent).toContain('Not yet. Soon.'));
    fireEvent.click(within(screen.getAllByTestId('sm-post')[0]).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/feed-posts/d1'));
    fireEvent.click(screen.getByRole('tab', { name: 'Deleted' }));
    await waitFor(() => expect(screen.getAllByTestId('sm-post')[0].textContent).toMatch(/deleted/));
    expect(screen.queryByLabelText("What's on your mind?")).toBeNull();
    fireEvent.click(within(screen.getAllByTestId('sm-post')[0]).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts/d1/restore'));
    await waitFor(() => expect(screen.getByTestId('sm-empty').textContent).toContain('No deleted posts'));
    confirm.mockRestore();
  });

  test('Relationship shares a relationship post; the Info box reads the newest one', async () => {
    renderAt('/feed');
    await screen.findAllByTestId('sm-post');
    expect(screen.getByTestId('sm-rel-status').textContent).toBe("it's complicated");
    fireEvent.click(screen.getByLabelText('Relationship'));
    fireEvent.click(screen.getByRole('button', { name: 'Single' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts', expect.objectContaining({
      show_id: SHOW.id, post_type: 'relationship', content_text: 'changed her relationship status to "Single."', poster_handle: 'lala', status: 'draft',
    })));
    // A draft changes nothing until it is released.
    await waitFor(() => expect(screen.getAllByTestId('sm-post')[0].textContent).toContain('Single'));
    expect(screen.getByTestId('sm-rel-status').textContent).toBe("it's complicated");
    fireEvent.click(within(screen.getAllByTestId('sm-post')[0]).getByRole('button', { name: 'Release' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Wall' }));
    await waitFor(() => expect(screen.getByTestId('sm-rel-status').textContent).toBe('Single'));
  });

  test('the profile column: her portrait, an older relationship post, and nothing made up when nothing is set', async () => {
    lalaColumn = { ...lalaColumn, portrait_url: 'https://x/lala.png', home_city: null, career: null, profile: { ...LALA, relationship_status: null } };
    relPosts = [{ id: 'r1', poster_handle: 'lala', post_type: 'relationship', content_text: 'changed her relationship status to "Engaged."', status: 'live', posted_at: '2026-01-01T00:00:00Z' }];
    renderAt('/feed');
    expect((await screen.findByTestId('sm-portrait')).getAttribute('src')).toBe('https://x/lala.png');
    await waitFor(() => expect(screen.getByTestId('sm-rel-status').textContent).toBe('Engaged'));
    expect(screen.queryByTestId('sm-city')).toBeNull();
    expect(screen.queryByTestId('sm-career')).toBeNull();
  });

  test('the profile column says so when it could not be read', async () => {
    const get = vi.mocked(api.get).getMockImplementation();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/social-profiles/lala?')) throw Object.assign(new Error('boom'), { response: { status: 500 } });
      return get(url);
    });
    renderAt('/feed');
    await waitFor(() => expect(screen.getByTestId('sm-friends').textContent).toContain('Friends could not be read.'));
    expect(screen.getByRole('heading', { name: 'Lala' })).toBeTruthy();
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

  test('Friends lists her friends only, each opening its profile in World Studio; the old ?layer= link lands there', async () => {
    renderAt('/feed?layer=lalaverse');
    const tab = await screen.findByTestId('sm-friends-tab');
    expect(screen.queryByTestId('people')).toBeNull();
    await waitFor(() => expect(screen.getAllByTestId('sm-friends-row')).toHaveLength(2));
    expect(api.get).toHaveBeenCalledWith(`/api/v1/social-profiles/lala?show_id=${SHOW.id}&friends=all`);
    expect(screen.getAllByTestId('sm-friends-row').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['MMarcus@marcus.k', '/world-studio?tab=feed&layer=lalaverse&profile=2'], ['BBestie@bestie', '/world-studio?tab=feed&layer=lalaverse&profile=4'],
    ]);
    expect(tab.textContent).toContain('Friends (2)');
    expect(screen.getByTestId('sm-add-people').getAttribute('href')).toBe('/world-studio?tab=feed&layer=lalaverse');
    expect(screen.queryByTestId('sm-post')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Home' }));
    await screen.findAllByTestId('sm-post');
  });

  test('Friends with none says what a friend is and where to make one', async () => {
    lalaColumn = { ...lalaColumn, friends: { total: 0, list: [] } };
    renderAt('/feed?tab=people');
    const empty = await screen.findByTestId('sm-friends-empty');
    expect(empty.textContent).toContain('Direct');
    expect(empty.querySelector('a').getAttribute('href')).toBe('/world-studio?tab=feed&layer=lalaverse');
  });
});
