import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../services/api';
import ReleaseBoard from './ReleaseBoard';

const episodes = [
  { id: 'e1', episode_number: 1, title: 'Studio', status: 'published', evaluation_json: { tier_final: 'pass' } },
  { id: 'e2', episode_number: 2, title: 'Gala Night', status: 'in_build' },
  { id: 'e3', episode_number: 3, title: 'Rooftop', status: 'draft', air_date: '2026-11-03' },
];
const history = [{ episode_id: 'e1', deltas_json: { coins: 650, reputation: 2 } }];
const wrap = () => render(<MemoryRouter><ReleaseBoard showId="show-1" episodes={episodes} history={history} /></MemoryRouter>);

describe('Release board', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockClear();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/e2') return { data: { data: { id: 'e2', title: 'Gala Night', status: 'in_build', thumbnail_url: 'https://x/t.png', title_approved_at: 'x', title_approved_value: 'Gala Night' } } };
      if (url === '/api/v1/episodes/e9') return { data: { data: { id: 'e9', title: 'Soon', status: 'scripted', distribution_metadata: { youtube: { scheduled_time: '2026-10-12T18:00' } } } } };
      if (url === '/api/v1/feed-posts/episode/e2') return { data: { data: [
        { id: 'p1', poster_display_name: 'Lala', content_text: 'Tonight, the gala.', timeline_position: 'before_episode', status: 'draft' },
        { id: 'p2', poster_handle: '@stable', content_text: 'Saw her shoes.', timeline_position: 'next_day', status: 'live' },
      ] } };
      return { data: {} };
    });
  });

  test('the next release, with its checklist from the full episode and its posts', async () => {
    wrap();
    const next = screen.getByTestId('release-next');
    expect(within(next).getByText('Episode 2 · Gala Night')).toBeTruthy();
    expect(within(next).getByText('No go-live date yet')).toBeTruthy();
    await waitFor(() => expect(within(screen.getByTestId('release-ready-thumbnail')).getByText('Ready')).toBeTruthy());
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/e2');
    expect(within(screen.getByTestId('release-ready-cut')).getByText('In the edit')).toBeTruthy();
    expect(within(screen.getByTestId('release-ready-copy')).getByText('Title approved · no copy yet')).toBeTruthy();
    expect(within(screen.getByTestId('release-ready-feed')).getByText('1 draft · 1 live')).toBeTruthy();
    expect(screen.getByTestId('release-ready-schedule').className).toContain('state-todo');
    expect(within(next).getByText('Open its distribution').getAttribute('href')).toBe('/episodes/e2?tab=distribution');
  });

  test('the posts going out, with when and their status', async () => {
    wrap();
    const post = await screen.findByTestId('release-post-p1');
    expect(post.textContent).toContain('Tonight, the gala.');
    expect(post.textContent).toContain('Before the episode');
    expect(post.textContent).toContain('Draft');
    expect(screen.getByTestId('release-post-p2').textContent).toContain('Next day');
    expect(screen.getByTestId('release-post-p2').textContent).toContain('Live');
    expect(screen.getByText('Drafts go live when the episode is published.')).toBeTruthy();
  });

  test('the calendar and the results', async () => {
    wrap();
    const cal = screen.getByTestId('release-calendar');
    expect(within(cal).getByText('Episode 2')).toBeTruthy();
    expect(within(cal).getByText('In production')).toBeTruthy();
    expect(within(cal).getByText('Scheduled · Nov 3, 2026')).toBeTruthy();
    const result = screen.getByTestId('release-result-e1');
    expect(result.textContent).toContain('PASS');
    expect(result.textContent).toContain('Episode 1 · Studio');
    expect(result.textContent).toContain('Reputation +2');
    expect(result.textContent).toContain('+650 coins');
    await waitFor(() => expect(screen.getByTestId('release-post-p1')).toBeTruthy());
  });

  test('with every episode released it says so', () => {
    render(<MemoryRouter><ReleaseBoard showId="show-1" episodes={[episodes[0]]} history={[]} /></MemoryRouter>);
    expect(screen.getByText(/Every episode is released/)).toBeTruthy();
    expect(screen.getByText('Nothing waiting to be released.')).toBeTruthy();
  });

  test('the calendar reads the next episode\'s full row, so its schedule matches the card', async () => {
    render(<MemoryRouter><ReleaseBoard showId="show-1" episodes={[{ id: 'e9', episode_number: 9, title: 'Soon', status: 'scripted' }]} history={[]} /></MemoryRouter>);
    await waitFor(() => expect(within(screen.getByTestId('release-calendar')).getByText(/^Scheduled · Oct 12, 2026/)).toBeTruthy());
    expect(within(screen.getByTestId('release-next')).getByText(/^Goes live Oct 12, 2026/)).toBeTruthy();
  });
});
