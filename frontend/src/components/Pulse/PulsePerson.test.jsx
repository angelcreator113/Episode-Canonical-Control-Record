/**
 * Someone's profile on The Pulse (Evoni, 2026-10-19): who they are, their
 * audience number, how they and Lala follow each other, their posts; an
 * ADMIN gets the two follow switches and the full character page link.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), post: vi.fn() } }));
import api from '../../services/api';
import PulsePerson, { followBadges, orderPosts, pictureLine } from './PulsePerson';

const SHOW = { id: 'show-1' };
const PROFILE = { id: 7, handle: 'maren', display_name: 'Maren', bio: 'baker and early riser', city: 'echo_park', portrait_url: null };
let relation;
let media;
let feed;
const renderIt = (props = {}) => render(
  <MemoryRouter><PulsePerson show={SHOW} handle="@maren" viewAt="present" {...props} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  relation = { follows_lala: true, lala_follows: false, friends: false };
  media = { pinned: [], tagged: [], highlights: [] };
  feed = [
    { id: 'a', content_text: 'Dough at 5am', image_url: 'https://cdn/dough.jpg' },
    { id: 'b', content_text: 'Quiet morning' },
  ];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/pulse-follows/profile/maren/media') return { data: { data: media } };
    if (url.startsWith('/api/v1/pulse-follows/profile/maren')) {
      return { data: { data: { profile: PROFILE, is_lala: false, followers: { count: 1200, tier: null, estimated: false }, relation, character_id: 'char-7' } } };
    }
    if (url.startsWith('/api/v1/feed-posts?')) return { data: { data: feed } };
    return { data: {} };
  });
});

describe('followBadges', () => {
  test('one way each side; Friends when both', () => {
    expect(followBadges({ follows_lala: true, lala_follows: false }).map((b) => b.text)).toEqual(['Follows Lala']);
    expect(followBadges({ follows_lala: false, lala_follows: true }).map((b) => b.text)).toEqual(['Lala follows']);
    expect(followBadges({ follows_lala: true, lala_follows: true, friends: true }).map((b) => b.text)).toEqual(['Friends']);
    expect(followBadges(null)).toEqual([]);
  });
});

describe('orderPosts and pictureLine', () => {
  test('pinned first in pin order, then the rest as read', () => {
    const posts = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(orderPosts(posts, ['3', 1]).map((p) => p.id)).toEqual([3, 1, 2, 4]);
    expect(orderPosts(posts).map((p) => p.id)).toEqual([1, 2, 3, 4]);
  });
  test('where a picture stands, and what moves it on', () => {
    expect(pictureLine(null)).toBeNull();
    expect(pictureLine({ state: 'pending' })).toEqual({ short: 'Making…', text: 'Its picture is being made.' });
    expect(pictureLine({ state: 'waiting_cap', reason: 'Limit reached.' })).toEqual({ short: 'Waiting', text: 'Limit reached.', action: 'make_now' });
    expect(pictureLine({ state: 'failed', error: 'Budget used up.' })).toEqual({ short: 'Failed', text: 'Budget used up.', action: 'retry' });
    expect(pictureLine({ state: 'made', cost_usd: 0.2 })).toEqual({ short: '$0.20', text: 'Picture made, $0.20.' });
    expect(pictureLine({ state: 'made', reused: true })).toMatchObject({ short: 'From roll', text: expect.stringMatching(/no cost/) });
  });
});

describe('PulsePerson', () => {
  test('the profile: name, handle and city, bio, audience number, badge and a grid of posts; reads at the story moment', async () => {
    renderIt();
    expect(await screen.findByRole('heading', { name: 'Maren' })).toBeTruthy();
    expect(screen.getByText('@maren · Echo Park')).toBeTruthy();
    expect(screen.getByTestId('pp-bio').textContent).toBe('baker and early riser');
    expect(screen.getByTestId('pp-followers').textContent).toMatch(/^1,200 followers/);
    expect(screen.getAllByTestId('pp-badge').map((b) => b.textContent.trim())).toEqual(['Follows Lala']);
    const tiles = await screen.findAllByTestId('pp-post');
    expect(tiles).toHaveLength(2);
    expect(tiles[0].querySelector('img').getAttribute('src')).toBe('https://cdn/dough.jpg');
    expect(tiles[1].textContent).toBe('Quiet morning');
    expect(vi.mocked(api.get).mock.calls[0][0]).toBe('/api/v1/pulse-follows/profile/maren?show_id=show-1&at=present');
    expect(vi.mocked(api.get).mock.calls[1][0]).toContain('profile_id=7');
    expect(screen.queryByTestId('pp-admin')).toBeNull();
  });

  test('an admin flips "Lala follows them" on and "Follows Lala" off; Friends shows when both', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { follows_lala: true, lala_follows: true, friends: true } } });
    vi.mocked(api.delete).mockResolvedValue({ data: { data: { follows_lala: false, lala_follows: true, friends: false } } });
    renderIt({ admin: true });
    const lalaFollows = await screen.findByTestId('pp-lala-follows');
    expect(lalaFollows.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('pp-character-link').getAttribute('href')).toBe('/character/char-7');

    fireEvent.click(lalaFollows);
    await waitFor(() => expect(screen.getAllByTestId('pp-badge').map((b) => b.textContent.trim())).toEqual(['Friends']));
    expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-follows/7/lala-follows');
    expect(screen.getByTestId('pp-lala-follows').getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByTestId('pp-follows-lala'));
    await waitFor(() => expect(screen.getAllByTestId('pp-badge').map((b) => b.textContent.trim())).toEqual(['Lala follows']));
    expect(api.delete).toHaveBeenCalledWith('/api/v1/pulse-follows/7/follows-lala');
  });

  test('a refused change is said plainly and changes nothing', async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { status: 403, data: { error: 'Admins only.' } } });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIt({ admin: true });
    fireEvent.click(await screen.findByTestId('pp-lala-follows'));
    expect((await screen.findByRole('alert')).textContent).toBe('Admins only.');
    expect(screen.getAllByTestId('pp-badge').map((b) => b.textContent.trim())).toEqual(['Follows Lala']);
    err.mockRestore();
  });

  test('nobody with that handle: said, with a way back', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onBack = vi.fn();
    renderIt({ onBack });
    expect((await screen.findByRole('alert')).textContent).toBe('That profile could not be found.');
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(onBack).toHaveBeenCalled();
    err.mockRestore();
  });

  test('a real profile grid: pinned first, a carousel marked, a words-only post as a text tile; no admin controls for a member', async () => {
    feed = [
      { id: 'a', content_text: 'Dough at 5am', image_url: 'https://cdn/dough.jpg' },
      { id: 'b', content_text: 'Quiet morning', post_format: 'text' },
      { id: 'c', content_text: 'Market day', post_format: 'carousel', photos: [{ url: 'https://cdn/1.jpg' }, { url: 'https://cdn/2.jpg' }] },
    ];
    media = { pinned: ['c'], tagged: [], highlights: [] };
    renderIt();
    await waitFor(() => expect(screen.getAllByTestId('pp-pinned')).toHaveLength(1));
    const tiles = screen.getAllByTestId('pp-post');
    expect(tiles.map((t) => t.querySelector('img')?.getAttribute('src') || t.textContent)).toEqual(['https://cdn/1.jpg', 'https://cdn/dough.jpg', 'Quiet morning']);
    expect(tiles[0].querySelector('[data-testid="pp-carousel"]')).toBeTruthy();
    expect(tiles[2].className).toContain('pp-tile-text');
    expect(screen.queryByTestId('pp-pin')).toBeNull();
    expect(screen.queryByTestId('pp-picture')).toBeNull();
  });

  test('Tagged and Highlights tabs: photos others posted with them, and their albums', async () => {
    media = {
      pinned: [],
      tagged: [{ asset_id: 't1', url: 'https://cdn/brunch.jpg', caption: 'Brunch', post_id: 'p9', poster_handle: 'nia' }],
      highlights: [{ key: 'travel', label: 'Travel & Places', count: 2, cover: 'https://cdn/bridge.jpg',
        photos: [{ asset_id: 'h1', url: 'https://cdn/bridge.jpg', caption: 'Bridge' }, { asset_id: 'h2', url: 'https://cdn/train.jpg', caption: 'Train' }] }],
    };
    renderIt();
    await screen.findAllByTestId('pp-post');
    await waitFor(() => expect(screen.getByTestId('pp-tab-tagged').textContent).toBe('Tagged (1)'));
    fireEvent.click(screen.getByTestId('pp-tab-tagged'));
    const tagged = screen.getAllByTestId('pp-tagged');
    expect(tagged).toHaveLength(1);
    expect(tagged[0].textContent).toBe('@nia');
    fireEvent.click(screen.getByTestId('pp-tab-highlights'));
    fireEvent.click(screen.getByTestId('pp-highlight'));
    const photos = screen.getByTestId('pp-highlight-photos').querySelectorAll('img');
    expect([...photos].map((i) => i.getAttribute('src'))).toEqual(['https://cdn/bridge.jpg', 'https://cdn/train.jpg']);
  });

  test("an admin pins a post, and sees a waiting picture with Make now", async () => {
    feed = [
      { id: 'a', content_text: 'Dough at 5am', image_url: 'https://cdn/dough.jpg', picture_job: { state: 'made', cost_usd: 0.2 } },
      { id: 'w', content_text: 'Rainy walk', picture_job: { state: 'waiting_cap', reason: "Today's post-picture limit (20) is reached; it will be made tomorrow, or press Make now." } },
    ];
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: 'a', pinned_at: 'now' } } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, job: { state: 'made' } } });
    renderIt({ admin: true });
    await screen.findAllByTestId('pp-post');
    const lines = await screen.findAllByTestId('pp-picture');
    expect(lines.map((l) => l.getAttribute('title'))).toEqual(['Picture made, $0.20.', expect.stringMatching(/limit \(20\) is reached/)]);
    expect(lines[1].textContent).toMatch(/^Waiting.*Make now$/);
    fireEvent.click(screen.getAllByTestId('pp-pin')[0]);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-follows/posts/a/pin'));
    fireEvent.click(screen.getByTestId('pp-make-now'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/post-media/posts/w/picture', { make_now: true }));
  });

  test('a refused pin is said plainly', async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { status: 409, data: { error: 'They already have 3 pinned posts. Unpin one first.' } } });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIt({ admin: true });
    await screen.findAllByTestId('pp-post');
    fireEvent.click(screen.getAllByTestId('pp-pin')[0]);
    expect((await screen.findByRole('alert')).textContent).toBe('They already have 3 pinned posts. Unpin one first.');
    err.mockRestore();
  });
});
