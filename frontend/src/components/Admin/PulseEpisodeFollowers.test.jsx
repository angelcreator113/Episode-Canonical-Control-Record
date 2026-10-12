/**
 * Admin › The Pulse › Review › Episode followers (Task 2956): each completed
 * episode's proposed change to Lala's followers, why, and Accept or Adjust
 * (the change and a one-line reason). Review's count includes them.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import { EpisodeFollowersCard, episodeLines, episodeOf } from './PulseEpisodeFollowers';
import PulseReview, { loadReviewCount } from './PulseReview';
import { PulseRevealProvider } from './PulseRevealContext';

const ROW = {
  id: 'f1', social_profile_id: 7, handle: 'lala', cause: 'episode', status: 'proposed', story_order: 27, change: 7250, count_after: 107250,
  factors: { tier: 'slay', score: 100, followers: 100000, followers_known: true, post_likes: 50000, from_result: 6250, from_posts: 1000 },
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});

describe('helpers', () => {
  test('the episode from the story order, and why, a line each', () => {
    expect(episodeOf(ROW)).toBe(2);
    expect(episodeOf({})).toBeNull();
    expect(episodeLines(ROW.factors)).toEqual([
      'Result: SLAY (100/100)', '+6,250 from the result, on 100,000 followers', "+1,000 from the episode's posts (50,000 likes)",
    ]);
    expect(episodeLines({ tier: 'fail', score: 20, followers: 0, followers_known: false, post_likes: 0, from_result: 0, from_posts: 0 }))
      .toEqual(['Result: FAIL (20/100)', 'Lala has no accepted follower count yet', "0 from the episode's posts (0 likes)"]);
  });
});

describe('a card', () => {
  const renderCard = () => {
    const onChange = vi.fn();
    render(<ul><EpisodeFollowersCard row={ROW} onChange={onChange} /></ul>);
    return onChange;
  };

  test('the episode, the change and why; Accept accepts', async () => {
    const onChange = renderCard();
    expect(screen.getByText('Episode 2')).toBeTruthy();
    expect(screen.getByTestId('prv-epf-change').textContent).toBe('+7,250 followers');
    expect(within(screen.getByRole('list', { name: 'Why this change' })).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-followers/f1/accept', undefined);
  });

  test('Adjust: the change and a one-line reason; saving needs the reason; a loss is allowed', async () => {
    const onChange = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    const form = screen.getByTestId('prv-epf-adjust');
    const change = within(form).getByLabelText('Change in followers');
    expect(change.value).toBe('7250');
    const save = within(form).getByRole('button', { name: 'Save change' });
    expect(save.disabled).toBe(true);
    fireEvent.change(change, { target: { value: '-300' } });
    fireEvent.change(within(form).getByLabelText('Why, in one line'), { target: { value: 'The rival clip backfired.' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-followers/f1/adjust', { change: -300, reason: 'The rival clip backfired.' });
  });

  test("the server's refusal is shown", async () => {
    vi.mocked(api.put).mockRejectedValueOnce({ response: { status: 409, data: { error: "Accept Lala's starting follower count first." } } });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect((await screen.findByRole('alert')).textContent).toBe("Accept Lala's starting follower count first.");
  });
});

describe('in Review', () => {
  let proposed;
  beforeEach(() => {
    // Lala's starting count also waits, but it is not an episode change.
    proposed = [ROW, { ...ROW, id: 'f0', cause: 'start', story_order: 0 }];
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/pulse-followers?')) return { data: { success: true, counts: [], proposed } };
      if (url.includes('/comments/pending')) return { data: { data: [] } };
      if (url.includes('/feed-posts')) return { data: { data: [], total: 0 } };
      return { data: {} };
    });
    vi.mocked(api.put).mockImplementation(async (url) => {
      proposed = proposed.filter((p) => !url.includes(`/${p.id}/`));
      return { data: { success: true } };
    });
  });

  test('an "Episode followers" section with only episode changes; accepting one takes it away and the count down', async () => {
    const onCount = vi.fn();
    render(<MemoryRouter><PulseRevealProvider showId="show-1"><PulseReview showId="show-1" onCount={onCount} /></PulseRevealProvider></MemoryRouter>);
    const section = await screen.findByTestId('prv-episode-followers');
    await waitFor(() => expect(within(section).getAllByTestId('prv-epf')).toHaveLength(1));
    expect(within(section).getByRole('heading').textContent).toBe('Episode followers (1)');
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1));
    fireEvent.click(within(section).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(within(section).queryAllByTestId('prv-epf')).toHaveLength(0));
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(0));
  });

  test('loadReviewCount adds the episode changes', async () => {
    expect(await loadReviewCount('show-1')).toBe(1);
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-followers?show_id=show-1');
  });
});
