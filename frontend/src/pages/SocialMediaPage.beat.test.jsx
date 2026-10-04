/**
 * Use in a beat (2026-10-04): a wall post is put at an episode's beat,
 * whose phone moment then points at the post (docs/FEED_POSTS.md rule 5);
 * the picker shows where the post is already shown; a draft only offers
 * its own episode.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../services/api';
import { PostCard } from './SocialMediaPage';

const EPISODES = [{ id: 'ep-1', episode_number: 1, title: 'Gala Night' }, { id: 'ep-2', episode_number: 2, title: 'Fittings' }];
let used;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  used = [];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/episodes')) return { data: { data: EPISODES } };
    if (url.startsWith('/api/v1/feed-posts/post/')) return { data: { data: { id: 'p1', beats: used } } };
    return { data: { data: [] } };
  });
  vi.mocked(api.post).mockImplementation(async (url, body) => {
    used = [{ moment_id: 'm1', episode_id: 'ep-2', beat_number: body.beat_number, episode_number: 2 }];
    return { data: { created: true, data: {} } };
  });
});

const open = (post) => {
  render(<MemoryRouter><PostCard post={post} showId="s-1" /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Use in a beat' }));
};

describe('Use in a beat', () => {
  test('puts a live post at the chosen episode and beat, then says where it is shown', async () => {
    open({ id: 'p1', poster_handle: 'lala', content_text: 'is not doing this again.', status: 'live' });
    await screen.findByRole('option', { name: 'Ep 2 · Fittings' });
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes?show_id=s-1&limit=100&sort=episode_number:ASC');
    expect(screen.getByRole('group', { name: "On Lala's Phone" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show at this beat' }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Episode'), { target: { value: 'ep-2' } });
    fireEvent.change(screen.getByLabelText('Beat'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show at this beat' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-enhanced/s-1/moments/ep-2/beat', { beat_number: 5, feed_post_id: 'p1' }));
    expect((await screen.findByRole('status')).textContent).toBe('Shown at beat 5, Reveal.');
    expect((await screen.findByTestId('sm-beats-used')).textContent).toBe('Shown at: Ep 2 · beat 5 Reveal');
  });

  test('a draft offers only its own episode, preselected and fixed', async () => {
    open({ id: 'p1', poster_handle: 'lala', content_text: 'Not yet.', status: 'draft', episode_id: 'ep-1' });
    await screen.findByRole('option', { name: 'Ep 1 · Gala Night' });
    expect(screen.queryByRole('option', { name: 'Ep 2 · Fittings' })).toBeNull();
    const ep = screen.getByLabelText('Episode');
    expect(ep.value).toBe('ep-1');
    expect(ep.disabled).toBe(true);
    expect(screen.getByText('A draft can only be shown in its own episode.')).toBeTruthy();
  });
});
