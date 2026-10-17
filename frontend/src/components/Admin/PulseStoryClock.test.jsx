/**
 * Admin › The Pulse › Story clock (Task 2941; spec §4): the moments come
 * from the show's numbered episodes; it starts at the present; changing the
 * moment re-reads The Pulse with ?at=; the preview is Lala's view (reveals
 * applied by the server); "Open in The Pulse" carries ?at=.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import { StoryMomentPreview as PulseStoryClock } from './PulseStoryClock';
import { PulseRevealProvider } from './PulseRevealContext';
import { storyMoments, presentOrder } from '../../lib/storyClock';

const SHOW = 'show-1';
const EPISODES = [
  { id: 'ep1', episode_number: 1, status: 'published' },
  { id: 'ep2', episode_number: 2, status: 'draft' },
  { id: 'epx', episode_number: null, status: 'draft' },
];
const calls = () => vi.mocked(api.get).mock.calls.map(([u]) => u);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/episodes?')) return { data: { data: EPISODES } };
    if (url.startsWith('/api/v1/pulse-reveals?')) return { data: { reveals: [] } };
    if (url.startsWith('/api/v1/feed-posts?')) {
      const at = new URL(url, 'http://x').searchParams.get('at');
      const posts = at === '17' ? [{ id: 'p1', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'After the first episode.', comments: [] }]
        : [{ id: 'p2', poster_handle: 'lala', poster_display_name: 'Lala', content_text: null, teaser: true, comments: [] }];
      return { data: { data: posts, total: posts.length } };
    }
    if (url.startsWith('/api/v1/social-profiles/lala/sidebar?')) return { data: { data: { upcoming: [{ id: 'e1', name: 'The Gala', date: '2026-11-12' }], may_know: [] } } };
    if (url.startsWith('/api/v1/pulse-fits/latest?')) return { data: { latest: null } };
    if (url.includes('/pulse-cover')) return { data: { cover: { url: 'https://cdn/c.jpg', alt: 'Night', teaser: true } } };
    if (url.startsWith('/api/v1/pulse-reveals/cities?')) return { data: { cities: null, states: {} } };
    if (url.startsWith('/api/v1/page-content/')) return { data: {} };
    return { data: {} };
  });
});

const renderClock = () => render(
  <MemoryRouter><PulseRevealProvider showId={SHOW}><PulseStoryClock /></PulseRevealProvider></MemoryRouter>,
);

describe('story moments', () => {
  test('the backstory, then each numbered episode from before it to a week after', () => {
    const moments = storyMoments(EPISODES);
    expect(moments[0]).toEqual({ order: 7, label: 'Backstory' });
    expect(moments.slice(1, 9).map((m) => m.label)).toEqual([
      'Before Ep 1', 'Announced Ep 1', 'Invitation sent Ep 1', 'Lala arrives Ep 1', 'During Ep 1', 'After Ep 1', 'The day after Ep 1', 'A week after Ep 1',
    ]);
    expect(moments).toHaveLength(17);
    expect(moments.map((m) => m.order)).toEqual([...moments.map((m) => m.order)].sort((a, b) => a - b));
  });
  test('the present: after the latest published episode, else the backstory', () => {
    expect(presentOrder(EPISODES)).toBe(17);
    expect(presentOrder([{ episode_number: 3, status: 'draft' }])).toBe(7);
  });
});

describe('the Story clock tab', () => {
  test('starts at the present and shows Lala\'s view there; the link carries ?at=', async () => {
    renderClock();
    await waitFor(() => expect(screen.getByTestId('pulse-clock-label').textContent).toBe('After Ep 1 · the present'));
    expect(await screen.findByText('After the first episode.')).toBeTruthy();
    expect(screen.getByTestId('pulse-clock-open').getAttribute('href')).toBe('/pulse?at=17');
    expect(calls()).toEqual(expect.arrayContaining([
      `/api/v1/feed-posts?show_id=${SHOW}&status=live&with=comments&limit=20&at=17`,
      `/api/v1/social-profiles/lala/sidebar?show_id=${SHOW}&at=17`,
      `/api/v1/pulse-fits/latest?show_id=${SHOW}&at=17`,
      `/api/v1/shows/${SHOW}/pulse-cover?at=17`,
      `/api/v1/pulse-reveals/cities?show_id=${SHOW}&at=17`,
    ]));
    // Lala's view never reads the cities' catalog, which carries their full images (Task 3041).
    expect(calls().some((u) => u.startsWith('/api/v1/page-content/'))).toBe(false);
    expect(screen.getByTestId('pl-first-look')).toBeTruthy(); // the teaser cover is blurred
    expect(screen.getByTestId('pulse-clock-count').textContent).toBe('1 post by this moment.');
  });

  test('changing the moment re-reads The Pulse at it; back to the present returns', async () => {
    renderClock();
    await screen.findByText('After the first episode.');
    fireEvent.click(screen.getByRole('button', { name: 'A later moment' }));
    await waitFor(() => expect(screen.getByTestId('pulse-clock-label').textContent).toContain('The day after Ep 1'));
    await waitFor(() => expect(calls()).toContain(`/api/v1/feed-posts?show_id=${SHOW}&status=live&with=comments&limit=20&at=18`));
    expect(await screen.findByTestId('pl-post-teaser')).toBeTruthy();
    expect(screen.getByTestId('pulse-clock-open').getAttribute('href')).toBe('/pulse?at=18');

    fireEvent.change(screen.getByTestId('pulse-clock-slider'), { target: { value: '0' } });
    await waitFor(() => expect(screen.getByTestId('pulse-clock-label').textContent).toContain('Backstory'));
    expect(screen.getByRole('button', { name: 'An earlier moment' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Back to the present' }));
    await waitFor(() => expect(screen.getByTestId('pulse-clock-label').textContent).toBe('After Ep 1 · the present'));
  });

  test('outside the provider it renders nothing', () => {
    const { container } = render(<MemoryRouter><PulseStoryClock /></MemoryRouter>);
    expect(container.textContent).toBe('');
  });
});
