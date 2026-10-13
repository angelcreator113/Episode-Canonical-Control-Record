/**
 * The Pulse (Task 2926; docs/design/2026-10-the-pulse.md §2, §3): Lala's
 * view shows the frame (cover, The Pulse, Lala's avatar and followers,
 * navigation, the feed, upcoming events) and nothing behind the curtain: no
 * drafts, releases, inbox, beats, episode links, story labels or show
 * names. Admins get a Director toggle; Director view shows empty image
 * spots as "+ Add" links to Uploads and the links into the studio. The
 * composer saves Lala's draft (it waits in Admin › The Pulse › Review).
 * The director flows themselves are tested in components/Admin.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
let USER;
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: USER }) }));

import api from '../services/api';
import SocialMediaPage, { tabFromParams, posterOf, whenLabel, cityName } from './SocialMediaPage';

const SHOW = { id: '7b1d2c3e-4f50-4a61-8b72-93c4d5e6f708', name: 'Styling Adventures with Lala' };
const LALA = { id: 1, handle: 'lala', display_name: 'Lala', relationship_status: "it's complicated", follower_count_approx: '12k' };
const POSTS = [
  {
    id: 'p1', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'Gold heels or the ones I can walk in?',
    likes: 3, comments_count: 1, shares: 2, status: 'live', posted_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    author_portrait_url: 'https://cdn/lala.jpg', socialProfile: { handle: 'lala', city: 'dazzle_district' },
    comments: [{ id: 'c1', handle: 'marcus.k', display_name: 'Marcus', text: 'the jacket', portrait_url: null }],
  },
  { id: 'p2', poster_handle: 'rival', poster_display_name: 'The Rival', content_text: 'Some people peak early.', likes: 0, status: 'live', narrative_function: 'shade', episode_id: 'ep-1', story_order: 15, comments: [] },
];
const EVENTS = [{ id: 'e1', name: 'Wearable Experiments Studio Session', date: '2026-11-12', time: '6:30 PM', venue: "STUDIO BY SABLE's Studio", episode: { id: 'ep-1', number: 1 }, guest_count: 3 }];
const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><SocialMediaPage /></MemoryRouter>);

let posts;
let cover;
let trending;
let fit;
let cityStates;
let revealRows;
let lalaColumn;
beforeEach(() => {
  USER = { name: 'Viewer', groups: ['viewer'] };
  Object.values(api).forEach((fn) => fn.mockReset());
  posts = [...POSTS];
  cover = null;
  trending = [{ topic: '#VelvetSeason', post_count: 2 }];
  fit = null;
  cityStates = {};
  revealRows = [];
  lalaColumn = {
    profile: LALA, portrait_url: 'https://cdn/lala.jpg', home_city: 'Echo Park', career: { tier: 1, label: 'Emerging' },
    friends: { total: 2, list: [{ id: 2, handle: 'marcus.k', display_name: 'Marcus' }, { id: 4, handle: 'bestie', display_name: 'Bestie' }] },
  };
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.includes('/shows') && url.includes('pulse-cover')) return { data: { cover } };
    if (url.includes('/shows')) return { data: { data: [SHOW] } };
    if (url.startsWith('/api/v1/social-profiles/lala/sidebar?')) return { data: { data: { upcoming: EVENTS, may_know: [{ id: 21, handle: 'nia', display_name: 'Nia' }] } } };
    if (url.startsWith('/api/v1/social-profiles/lala?')) return { data: { data: lalaColumn } };
    if (url.includes('/social-profiles')) return { data: { profiles: [LALA, { id: 2, handle: 'marcus.k', display_name: 'Marcus' }] } };
    if (url.includes('post_type=relationship')) return { data: { data: [] } };
    if (url.includes('/feed-enhanced/') && /\/trending(\?|$)/.test(url)) return { data: { success: true, data: trending } };
    if (url.startsWith('/api/v1/pulse-fits/latest?')) return { data: { success: true, latest: fit } };
    if (url.startsWith('/api/v1/pulse-reveals/state?')) return { data: { success: true, at: 17, cities: cityStates } };
    if (url.startsWith('/api/v1/pulse-reveals?')) return { data: { success: true, reveals: revealRows } };
    if (url.includes('/feed-posts')) return { data: { data: posts, total: posts.length, hasMore: false } };
    return { data: {} };
  });
  vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'p3' } } });
});

describe('helpers', () => {
  test('tabFromParams: Feed by default; old ?layer= or ?profile= links open Characters', () => {
    expect(tabFromParams(new URLSearchParams(''))).toBe('posts');
    expect(tabFromParams(new URLSearchParams('tab=events'))).toBe('events');
    expect(tabFromParams(new URLSearchParams('tab=people'))).toBe('people');
    expect(tabFromParams(new URLSearchParams('tab=profile'))).toBe('profile');
    expect(tabFromParams(new URLSearchParams('tab=drafts'))).toBe('posts');
    expect(tabFromParams(new URLSearchParams('layer=lalaverse'))).toBe('people');
    expect(tabFromParams(new URLSearchParams('profile=12&layer=real_world'))).toBe('people');
  });
  test('posterOf, whenLabel and cityName', () => {
    expect(posterOf(POSTS[0])).toEqual({ name: 'Lala', handle: 'lala', platform: '' });
    const now = new Date('2026-10-04T15:00:00');
    expect(whenLabel(new Date('2026-10-04T14:59:30'), now)).toBe('Just now');
    expect(whenLabel(new Date('2026-10-03T23:42:00'), now)).toMatch(/^Yesterday at 11:42/);
    expect(cityName('dazzle_district')).toBe('Dazzle District');
    expect(cityName('nowhere')).toBeNull();
  });
});

describe("Lala's view", () => {
  test('the frame: The Pulse, the cover with its alt text, Lala and her followers, navigation', async () => {
    cover = { url: 'https://cdn/cover.jpg', alt: 'The five Dream Cities at night' };
    renderAt('/pulse');
    expect(screen.getByRole('heading', { name: /The\s*Pulse/ })).toBeTruthy();
    expect(screen.getByText('Every city has a story.')).toBeTruthy();
    const img = await screen.findByTestId('pl-cover');
    expect(img.getAttribute('alt')).toBe('The five Dream Cities at night');
    expect((await screen.findByTestId('pl-followers')).textContent).toBe('12k followers');
    const nav = within(screen.getByRole('navigation', { name: 'The Pulse' }));
    expect(nav.getByRole('button', { name: /Feed/ }).getAttribute('aria-current')).toBe('page');
    // Messages (Task 2985) and Dream Cities (Task 2987) are live.
    expect(nav.getByRole('button', { name: /Messages/ })).toBeTruthy();
    expect(nav.getByRole('button', { name: /Dream Cities/ })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'The Pulse on a phone' })).getByRole('button', { name: /Inbox/ }).disabled).toBe(false);
  });

  test('posts: who, when and city, the words, photo, likes, comments and shares, a first comment', async () => {
    renderAt('/pulse');
    const [first] = await screen.findAllByTestId('pl-post');
    expect(first.textContent).toContain('Lala');
    expect(first.textContent).toContain('Dazzle District');
    expect(first.textContent).toContain('Gold heels or the ones I can walk in?');
    expect(first.textContent).toMatch(/Likes3/);
    expect(first.textContent).toMatch(/Comments1/);
    expect(first.textContent).toMatch(/Shares2/);
    expect(first.textContent).toContain('Marcus the jacket');
    expect(first.querySelector('img.pl-avatar').getAttribute('src')).toBe('https://cdn/lala.jpg');
    const url = api.get.mock.calls.find((c) => c[0].includes('/feed-posts?'))[0];
    expect(url).toContain(`show_id=${SHOW.id}`);
    expect(url).toContain('status=live');
    expect(url).toContain('with=comments');
  });

  test('nothing behind the curtain: no drafts, releases, inbox, beats, episode links, story labels or show name; no toggle for non-admins', async () => {
    renderAt('/pulse');
    await screen.findAllByTestId('pl-post');
    await screen.findByTestId('pl-upcoming');
    const text = document.body.textContent;
    for (const word of ['Release', 'Draft', 'Drafts', 'Deleted', 'Inbox (', 'Use in a beat', 'Requests', 'shade', 'Ep 1', 'Episode', 'Styling Adventures', 'Timeline', 'Edit My Profile', 'Show Settings']) {
      expect(text).not.toContain(word);
    }
    expect(document.querySelector('a[href^="/episodes/"]')).toBeNull();
    expect(document.querySelector('a[href*="/events/"]')).toBeNull();
    expect(document.querySelector('a[href^="/world-studio"]')).toBeNull();
    expect(screen.queryByTestId('pl-director-toggle')).toBeNull();
    expect(screen.queryByText(/\+ Add cover/)).toBeNull();
    expect(screen.getByTestId('pl-upcoming').textContent).toBe("Upcoming EventsNov 12Wearable Experiments Studio SessionSTUDIO BY SABLE's Studio · 6:30 PM");
  });

  test('search narrows the feed, and says so when nothing matches', async () => {
    renderAt('/pulse');
    await screen.findAllByTestId('pl-post');
    fireEvent.change(screen.getByLabelText('Search posts'), { target: { value: 'rival' } });
    expect(screen.getAllByTestId('pl-post')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Search posts'), { target: { value: 'zzz' } });
    expect(screen.queryAllByTestId('pl-post')).toHaveLength(0);
    expect(screen.getByText('No posts match “zzz”.')).toBeTruthy();
  });

  test('an empty feed reads "Nothing posted yet." and no sample content', async () => {
    posts = [];
    renderAt('/pulse');
    expect((await screen.findByTestId('pl-empty')).textContent).toBe('Nothing posted yet.');
  });

  test('the composer saves Lala\'s draft and says only "Sent."', async () => {
    renderAt('/pulse');
    await screen.findAllByTestId('pl-post');
    await waitFor(() => expect(screen.getByTestId('pl-followers')).toBeTruthy());
    fireEvent.change(screen.getByLabelText("What's happening in LaLaVerse?"), { target: { value: 'not doing this again.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts', expect.objectContaining({
      show_id: SHOW.id, content_text: 'not doing this again.', poster_handle: 'lala', social_profile_id: 1, status: 'draft',
    })));
    expect((await screen.findByRole('status')).textContent).toBe('Sent.');
  });

  test('Events, Characters and Profile views', async () => {
    renderAt('/pulse?tab=events');
    expect((await screen.findByTestId('pl-events')).textContent).toContain('Wearable Experiments Studio Session');
    expect(screen.getByTestId('pl-events').textContent).not.toContain('Episode');

    fireEvent.click(within(screen.getByRole('navigation', { name: 'The Pulse' })).getByRole('button', { name: /Characters/ }));
    await waitFor(() => expect(screen.getAllByTestId('pl-friend').map((li) => li.textContent)).toEqual(['MMarcus@marcus.k', 'BBestie@bestie']));
    expect(screen.queryByTestId('pl-add-people')).toBeNull();

    fireEvent.click(within(screen.getByRole('navigation', { name: 'The Pulse on a phone' })).getByRole('button', { name: /Profile/ }));
    await waitFor(() => expect(screen.getByTestId('pl-city').textContent).toBe('Echo Park'));
    expect(screen.getByTestId('pl-rel-status').textContent).toBe("it's complicated");
    expect(screen.getByTestId('pl-career').textContent).toBe('Emerging');
    expect(screen.getAllByTestId('pl-profile-friend')).toHaveLength(2);
  });

  test('stories: Lala, recent posters and the five cities; tapping a person filters the feed, x shows everyone', async () => {
    renderAt('/pulse');
    await screen.findAllByTestId('pl-post');
    const stories = within(screen.getByTestId('pl-stories'));
    expect(stories.getAllByTestId('pl-story-person').map((b) => b.querySelector('b').textContent)).toEqual(['Lala']);
    expect(stories.getAllByTestId('pl-story-city')).toHaveLength(5);
    fireEvent.click(stories.getAllByTestId('pl-story-person')[0]);
    expect(screen.getByTestId('pl-filter').textContent).toBe('Showing Lala');
    expect(screen.getAllByTestId('pl-post')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Show everyone, not only Lala' }));
    expect(screen.getAllByTestId('pl-post')).toHaveLength(2);
  });

  test('the old ?layer= link opens Characters', async () => {
    renderAt('/pulse?layer=lalaverse');
    expect(await screen.findByTestId('pl-people')).toBeTruthy();
  });
});

describe('Director view (admins only)', () => {
  beforeEach(() => { USER = { name: 'Evoni', groups: ['admin'] }; });

  test('the toggle shows empty spots as "+ Add" links to Uploads and the studio links; off again, they go', async () => {
    renderAt('/pulse');
    const toggle = screen.getByTestId('pl-director-toggle');
    expect(toggle.textContent).toBe("Lala's screen (what the audience sees)");
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await screen.findAllByTestId('pl-post');
    expect(screen.queryByText(/\+ Add cover/)).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.textContent).toBe('Director view: empty spots shown');
    const add = screen.getByText(/\+ Add cover/).closest('a');
    expect(add.getAttribute('href')).toBe('/admin?tab=pulse&sub=uploads');

    fireEvent.click(within(screen.getByRole('navigation', { name: 'The Pulse' })).getByRole('button', { name: /Characters/ }));
    expect((await screen.findByTestId('pl-add-people')).getAttribute('href')).toBe('/world-studio?tab=feed&layer=lalaverse');

    fireEvent.click(toggle);
    expect(screen.queryByText(/\+ Add cover/)).toBeNull();
    expect(screen.queryByTestId('pl-add-people')).toBeNull();
  });

  test('a cover hides its "+ Add" spot; in Director view the composer says where the draft went', async () => {
    cover = { url: 'https://cdn/cover.jpg', alt: 'Night' };
    renderAt('/pulse');
    await screen.findByTestId('pl-cover');
    fireEvent.click(screen.getByTestId('pl-director-toggle'));
    expect(screen.queryByText(/\+ Add cover/)).toBeNull();
    await screen.findAllByTestId('pl-post');
    await waitFor(() => expect(screen.getByTestId('pl-followers')).toBeTruthy());
    fireEvent.change(screen.getByLabelText("What's happening in LaLaVerse?"), { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect((await screen.findByRole('status')).textContent).toBe('Saved as a draft in Admin › The Pulse › Review.');
  });
});

describe('The sides (Task 2928)', () => {
  test('Trending reads live-post counts; the latest fit sits under the navigation; no footer or "+ Add" in Lala’s view', async () => {
    fit = { source: 'fit', image_url: 'https://cdn/fit.jpg', image_alt: 'Denim', caption: 'Sunday denim' };
    renderAt('/pulse');
    expect((await screen.findByTestId('pl-fit-photo')).closest('aside').className).toBe('pl-left');
    await waitFor(() => expect(screen.getAllByTestId('pl-trend')).toHaveLength(1));
    expect(screen.getByTestId('pl-trend').textContent).toBe('1#VelvetSeason2 posts');
    expect(vi.mocked(api.get).mock.calls.map(([u]) => u)).toEqual(expect.arrayContaining([
      `/api/v1/feed-enhanced/${SHOW.id}/trending?at=present`, `/api/v1/pulse-fits/latest?show_id=${SHOW.id}&at=present`,
    ]));
    expect(screen.queryByTestId('pl-trending-foot')).toBeNull();
    expect(document.body.textContent).not.toContain('+ Add');
  });

  test('Director view: "+ Add Lala’s latest fit" when there is none, and the trending footer', async () => {
    USER = { name: 'Evoni', groups: ['admin'] };
    renderAt('/pulse');
    await screen.findAllByTestId('pl-post');
    expect(screen.queryByTestId('pl-fit')).toBeNull();
    fireEvent.click(screen.getByTestId('pl-director-toggle'));
    expect(screen.getByRole('link', { name: /\+ Add Lala's latest fit/ }).getAttribute('href')).toBe('/admin?tab=pulse&sub=uploads');
    await waitFor(() => expect(screen.getByTestId('pl-trending-foot').textContent).toBe('Counted from approved posts'));
  });
});

describe('The story clock (Task 2937)', () => {
  const calls = () => vi.mocked(api.get).mock.calls.map(([u]) => u);
  const feedCalls = () => calls().filter((u) => u.startsWith('/api/v1/feed-posts?') && u.includes('with=comments'));

  test("Lala's view reads The Pulse as of the present: posts, events, the latest fit and relationship posts", async () => {
    renderAt('/pulse');
    await screen.findAllByTestId('pl-post');
    await waitFor(() => expect(calls().some((u) => u.startsWith('/api/v1/pulse-fits/latest?'))).toBe(true));
    expect(feedCalls().every((u) => u.includes('at=present'))).toBe(true);
    for (const prefix of ['/api/v1/social-profiles/lala/sidebar?', '/api/v1/pulse-fits/latest?']) {
      expect(calls().filter((u) => u.startsWith(prefix)).every((u) => u.endsWith('&at=present'))).toBe(true);
    }
    expect(calls().filter((u) => u.includes('post_type=relationship')).every((u) => u.includes('at=present'))).toBe(true);
  });

  test('Director view reads everything live, with no story moment', async () => {
    USER = { name: 'Evoni', groups: ['admin'] };
    renderAt('/pulse');
    await screen.findAllByTestId('pl-post');
    vi.mocked(api.get).mockClear();
    fireEvent.click(screen.getByTestId('pl-director-toggle'));
    await waitFor(() => expect(feedCalls().length).toBeGreaterThan(0));
    await waitFor(() => expect(calls().some((u) => u.startsWith('/api/v1/social-profiles/lala/sidebar?'))).toBe(true));
    expect(calls().some((u) => u.includes('at='))).toBe(false);
  });
});

describe('Reveals (Task 2939)', () => {
  const calls = () => vi.mocked(api.get).mock.calls.map(([u]) => u);

  test("Lala's view: the cover and friends are read as of the present; the cities' states are read; a teaser cover is its teaser image, labelled First look, with no CSS blur (Task 3034)", async () => {
    cover = { url: 'https://cdn/cover-teaser.jpg', alt: '', teaser: true, teaser_style: 'blur' };
    renderAt('/pulse');
    expect((await screen.findByTestId('pl-cover')).className).toBe('pl-cover');
    expect(screen.getByTestId('pl-cover').getAttribute('src')).toBe('https://cdn/cover-teaser.jpg');
    expect(screen.getByTestId('pl-cover').getAttribute('data-first-look')).toBe('blur');
    expect(screen.getByTestId('pl-cover').getAttribute('alt')).toBe('');
    expect(screen.getByTestId('pl-cover-first-look').textContent).toBe('First look');
    await waitFor(() => expect(calls().some((u) => u.startsWith('/api/v1/pulse-reveals/state?') && u.endsWith('&at=present'))).toBe(true));
    expect(calls().filter((u) => u.includes('/pulse-cover')).every((u) => u.endsWith('?at=present'))).toBe(true);
    expect(calls().filter((u) => u.startsWith('/api/v1/social-profiles/lala?show_id=') && !u.includes('sidebar')).every((u) => u.includes('at=present'))).toBe(true);
    expect(calls().some((u) => u.startsWith('/api/v1/pulse-reveals?'))).toBe(false);
    expect(screen.queryByTestId('pl-reveal-chip')).toBeNull();
  });

  test("a teaser post in Lala's view reads First look", async () => {
    posts = [{ id: 'p9', poster_handle: 'lala', poster_display_name: 'Lala', content_text: null, teaser: true, photo_teaser: true, image_url: 'https://cdn/x.jpg', status: 'live', comments: [] }];
    renderAt('/pulse');
    expect((await screen.findByTestId('pl-post-teaser')).textContent).toBe('First look');
  });

  test('Director view reads the reveal labels and shows the chip on a post', async () => {
    USER = { name: 'Evoni', groups: ['admin'] };
    revealRows = [{ item_type: 'post', item_id: 'p1', image_kind: null, label: 'During Ep 3' }, { item_type: 'character', item_id: '4', label: 'During Ep 2' }];
    renderAt('/pulse');
    await screen.findAllByTestId('pl-post');
    fireEvent.click(screen.getByTestId('pl-director-toggle'));
    await waitFor(() => expect(screen.getByTestId('pl-reveal-chip').textContent).toContain('During Ep 3'));
    expect(screen.getAllByTestId('pl-reveal-chip')).toHaveLength(1);
    expect(calls().some((u) => u.startsWith(`/api/v1/pulse-reveals?show_id=${SHOW.id}`))).toBe(true);
  });
});

describe('/pulse?at= (Task 2941)', () => {
  const calls = () => vi.mocked(api.get).mock.calls.map(([u]) => u);
  const feedCalls = () => calls().filter((u) => u.startsWith('/api/v1/feed-posts?') && u.includes('with=comments'));

  test('an admin sees The Pulse as of that story moment, with a way back to now', async () => {
    USER = { name: 'Evoni', groups: ['admin'] };
    renderAt('/pulse?at=24');
    await screen.findAllByTestId('pl-post');
    expect(screen.getByTestId('pl-at-banner').textContent).toContain('The Pulse as of Lala arrives Ep 2');
    expect(feedCalls().every((u) => u.includes('at=24'))).toBe(true);
    expect(calls().filter((u) => u.includes('/pulse-cover')).every((u) => u.endsWith('?at=24'))).toBe(true);
    expect(screen.getByRole('link', { name: 'Back to now' }).getAttribute('href')).toBe('/pulse');
  });

  test('anyone else always sees the present', async () => {
    renderAt('/pulse?at=24');
    await screen.findAllByTestId('pl-post');
    expect(screen.queryByTestId('pl-at-banner')).toBeNull();
    expect(feedCalls().every((u) => u.includes('at=present'))).toBe(true);
  });
});


describe('Dream Cities (Task 2987)', () => {
  test("the nav opens the cities; a city bubble opens that city's feed and trends at the moment; Back returns to the list", async () => {
    renderAt('/pulse');
    await screen.findAllByTestId('pl-post');
    const nav = within(screen.getByRole('navigation', { name: 'The Pulse' }));
    fireEvent.click(nav.getByRole('button', { name: /Dream Cities/ }));
    expect(await screen.findByTestId('pl-cityfeed-pick')).toBeTruthy();
    fireEvent.click(within(screen.getByTestId('pl-cityfeed-pick')).getAllByRole('button')[2]);
    const page = await screen.findByTestId('pl-cityfeed');
    const name = page.querySelector('.pl-cityfeed-name').textContent;
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.some(([u]) => u.startsWith(`/api/v1/feed-posts?show_id=${SHOW.id}&city=`) && u.endsWith('&at=present'))).toBe(true));
    const cityUrl = vi.mocked(api.get).mock.calls.map(([u]) => u).find((u) => u.includes('&city='));
    const key = new URLSearchParams(cityUrl.split('?')[1]).get('city');
    expect(vi.mocked(api.get).mock.calls.map(([u]) => u)).toContain(`/api/v1/feed-enhanced/${SHOW.id}/trending?city=${key}&at=present`);
    expect(name.length).toBeGreaterThan(0);
    fireEvent.click(within(page).getByRole('button', { name: /Dream Cities/ }));
    expect(await screen.findByTestId('pl-cityfeed-pick')).toBeTruthy();
  });

  test('a city in the stories row opens its feed from the Feed', async () => {
    renderAt('/pulse');
    await screen.findAllByTestId('pl-post');
    fireEvent.click(within(screen.getByTestId('pl-stories')).getAllByTestId('pl-story-city')[0]);
    expect(await screen.findByTestId('pl-cityfeed')).toBeTruthy();
  });
});
