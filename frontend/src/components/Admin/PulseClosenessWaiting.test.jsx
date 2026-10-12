/**
 * Admin › The Pulse › Review › Closeness waiting (Task 2983): each card shows
 * the pair, closeness before and after, the cause and the post behind it;
 * Accept, Adjust (a change in points and a one-line reason) and Reject call
 * /api/v1/pulse-closeness. Review's count includes the waiting changes.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import { ClosenessCard, points, signed } from './PulseClosenessWaiting';
import PulseReview, { loadReviewCount } from './PulseReview';
import { PulseRevealProvider } from './PulseRevealContext';

const ROW = {
  id: 'k1', profile_a_id: 1, profile_b_id: 7, story_order: 17, delta: 0.03, closeness_after: 0.73, closeness_before: 0.7,
  cause: 'comment', status: 'proposed', label: 'Ep 1 · After',
  a: { id: 1, handle: 'lala', display_name: 'Lala' }, b: { id: 7, handle: 'marcus.k', display_name: 'Marcus' },
  source: { post_id: 'p1', poster_handle: 'lala', content_text: 'The gold one won.', comment_text: 'obsessed' },
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});

test('points and signed changes', () => {
  expect(points(0.734)).toBe('73');
  expect(points(null)).toBe('—');
  expect(signed(0.03)).toBe('+3');
  expect(signed(-0.02)).toBe('-2');
});

describe('a waiting card', () => {
  const renderCard = (row = ROW, onChange = vi.fn()) => {
    render(<ul><ClosenessCard row={row} onChange={onChange} /></ul>);
    return onChange;
  };

  test('the pair, the change, the cause and the comment and post behind it', () => {
    renderCard();
    expect(screen.getByText('@lala ↔ @marcus.k')).toBeTruthy();
    expect(screen.getByText('Commented')).toBeTruthy();
    expect(screen.getByTestId('prv-close-change').textContent).toBe('Closeness 70 → 73+3Ep 1 · After');
    expect(screen.getByText('“obsessed”')).toBeTruthy();
    expect(screen.getByText('@lala: The gold one won.')).toBeTruthy();
  });

  test.each([['Accept', 'accept'], ['Reject', 'reject']])('%s calls its decision and reloads', async (name, action) => {
    const onChange = renderCard();
    fireEvent.click(screen.getByRole('button', { name }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith(`/api/v1/pulse-closeness/k1/${action}`, undefined);
  });

  test('Adjust takes a change in points and a one-line reason; out of range or no reason cannot save', async () => {
    const onChange = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    const form = screen.getByTestId('prv-close-adjust');
    const change = within(form).getByLabelText('Change (points, −20 to 20)');
    expect(change.value).toBe('3');
    const save = within(form).getByRole('button', { name: 'Save change' });
    expect(save.disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText('Why, in one line'), { target: { value: 'They barely know each other.' } });
    fireEvent.change(change, { target: { value: '25' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(change, { target: { value: '-1' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-closeness/k1/adjust', { delta: -0.01, reason: 'They barely know each other.' });
  });

  test('an ignored post, with no comment; an error from the server is shown', async () => {
    renderCard({ ...ROW, cause: 'ignored', delta: -0.02, closeness_after: 0.68, source: { post_id: 'p2', poster_handle: 'marcus.k', content_text: 'new single out', comment_text: null } });
    expect(screen.getByText("Ignored a close friend's post")).toBeTruthy();
    expect(screen.queryByText(/“/)).toBeNull();
    vi.mocked(api.put).mockRejectedValueOnce({ response: { status: 409, data: { error: 'This change was already decided.' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This change was already decided.');
  });
});

describe('in Review', () => {
  let waiting;
  beforeEach(() => {
    waiting = [ROW, { ...ROW, id: 'k2', cause: 'mention' }];
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/pulse-closeness?')) return { data: { success: true, total: waiting.length, changes: waiting } };
      if (url.includes('/comments/pending')) return { data: { data: [] } };
      if (url.includes('/feed-posts')) return { data: { data: [], total: 0 } };
      return { data: {} };
    });
    vi.mocked(api.put).mockImplementation(async (url) => {
      waiting = waiting.filter((c) => !url.includes(`/${c.id}/`));
      return { data: { success: true } };
    });
  });

  test('a "Closeness waiting" section with its count; a decision takes the card away and the count down', async () => {
    const onCount = vi.fn();
    render(<MemoryRouter><PulseRevealProvider showId="show-1"><PulseReview showId="show-1" onCount={onCount} /></PulseRevealProvider></MemoryRouter>);
    const section = await screen.findByTestId('prv-closeness');
    await waitFor(() => expect(within(section).getAllByTestId('prv-close')).toHaveLength(2));
    expect(within(section).getByRole('heading').textContent).toBe('Closeness waiting (2)');
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(2));
    fireEvent.click(within(section).getAllByRole('button', { name: 'Accept' })[0]);
    await waitFor(() => expect(within(section).getAllByTestId('prv-close')).toHaveLength(1));
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1));
  });

  test('loadReviewCount adds the waiting closeness changes', async () => {
    expect(await loadReviewCount('show-1')).toBe(2);
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-closeness?show_id=show-1&status=proposed');
  });
});
