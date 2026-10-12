/**
 * Admin › The Pulse › Review › Numbers waiting (Task 2954): each card shows
 * the post, the proposed numbers and why, and Accept, Adjust (two numbers
 * and a one-line reason), Make it viral and Make it flop call
 * /api/v1/pulse-numbers. Review's count includes the waiting numbers.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import { NumbersCard, factorLines } from './PulseNumbersWaiting';
import PulseReview, { loadReviewCount } from './PulseReview';
import { PulseRevealProvider } from './PulseRevealContext';

const ROW = {
  id: 'n1', post_id: 'p1', poster_handle: 'lala', status: 'proposed', flag: 'lala',
  proposed: { likes: 12400, shares: 372 },
  factors: { followers: 206000, followers_from: 'ledger', kind: 'fit', trending: true, trending_topic: '#GalaNight', episode_tier: 'slay', random: 1.04 },
  post: { id: 'p1', poster_handle: 'lala', content_text: 'The gold one won.', image_url: 'fit.jpg' },
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});

describe('factorLines', () => {
  test('followers, kind, trend, episode result, and the usual likes for a spike', () => {
    expect(factorLines(ROW.factors)).toEqual(['206,000 followers', 'Fit post', 'Riding #GalaNight', 'Episode result: slay']);
    expect(factorLines({ followers: 20000, followers_from: 'estimate "20k" (no ledger count yet)', kind: 'status', poster_median: 300 }))
      .toEqual(['20,000 followers (estimate "20k" (no ledger count yet))', 'Status', 'Usually about 300 likes']);
  });
});

describe('a waiting card', () => {
  const renderCard = (onChange = vi.fn()) => {
    render(<ul><NumbersCard row={ROW} onChange={onChange} /></ul>);
    return onChange;
  };

  test('the post, the proposed numbers, why, and the flag', () => {
    renderCard();
    expect(screen.getByText('@lala')).toBeTruthy();
    expect(screen.getByText('The gold one won.')).toBeTruthy();
    expect(screen.getByTestId('prv-num-proposed').textContent).toBe('12,400 likes372 shares');
    expect(screen.getByTestId('prv-num-flag').textContent).toBe("Lala's post");
    const why = within(screen.getByRole('list', { name: 'Why these numbers' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(why).toEqual(['206,000 followers', 'Fit post', 'Riding #GalaNight', 'Episode result: slay']);
  });

  test.each([
    ['Accept', 'accept'],
    ['Make it viral', 'viral'],
    ['Make it flop', 'flop'],
  ])('%s calls its decision and reloads', async (name, action) => {
    const onChange = renderCard();
    fireEvent.click(screen.getByRole('button', { name }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith(`/api/v1/pulse-numbers/n1/${action}`, undefined);
  });

  test('Adjust opens two number fields and a one-line reason; saving needs the reason', async () => {
    const onChange = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    const form = screen.getByTestId('prv-num-adjust');
    const likes = within(form).getByLabelText('Likes');
    const shares = within(form).getByLabelText('Shares');
    expect(likes.value).toBe('12400');
    expect(shares.value).toBe('372');
    const save = within(form).getByRole('button', { name: 'Save numbers' });
    expect(save.disabled).toBe(true);
    fireEvent.change(likes, { target: { value: '9000' } });
    fireEvent.change(within(form).getByLabelText('Why, in one line'), { target: { value: 'Quiet week, fewer eyes.' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-numbers/n1/adjust', { likes: 9000, shares: 372, reason: 'Quiet week, fewer eyes.' });
  });

  test('Cancel closes the form; an error from the server is shown', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('prv-num-adjust')).toBeNull();
    vi.mocked(api.put).mockRejectedValueOnce({ response: { status: 409, data: { error: 'These numbers are already decided and locked.' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect((await screen.findByRole('alert')).textContent).toBe('These numbers are already decided and locked.');
  });
});

describe('in Review', () => {
  let waiting;
  beforeEach(() => {
    waiting = [ROW, { ...ROW, id: 'n2', flag: 'spike', post: { ...ROW.post, poster_handle: 'marcus.k' } }];
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/pulse-numbers?')) return { data: { success: true, total: waiting.length, numbers: waiting } };
      if (url.includes('/comments/pending')) return { data: { data: [] } };
      if (url.includes('/feed-posts')) return { data: { data: [], total: 0 } };
      return { data: {} };
    });
    vi.mocked(api.put).mockImplementation(async (url) => {
      waiting = waiting.filter((n) => !url.includes(`/${n.id}/`));
      return { data: { success: true } };
    });
  });

  test('a "Numbers waiting" section with its count; a decision takes the card away and the count down', async () => {
    const onCount = vi.fn();
    render(<MemoryRouter><PulseRevealProvider showId="show-1"><PulseReview showId="show-1" onCount={onCount} /></PulseRevealProvider></MemoryRouter>);
    const section = await screen.findByTestId('prv-numbers');
    await waitFor(() => expect(within(section).getAllByTestId('prv-num')).toHaveLength(2));
    expect(within(section).getByRole('heading').textContent).toBe('Numbers waiting (2)');
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(2));
    fireEvent.click(within(section).getAllByRole('button', { name: 'Accept' })[0]);
    await waitFor(() => expect(within(section).getAllByTestId('prv-num')).toHaveLength(1));
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1));
  });

  test('loadReviewCount adds the waiting numbers', async () => {
    expect(await loadReviewCount('show-1')).toBe(2);
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-numbers?show_id=show-1&status=proposed');
  });
});
