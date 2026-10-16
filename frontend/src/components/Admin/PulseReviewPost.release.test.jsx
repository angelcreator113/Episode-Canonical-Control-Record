/**
 * Release time, the second clock (Character Consistency Engine step 6c;
 * Evoni, 2026-10-16: "yes publish/schedule/hold"): a draft in Review can be
 * released now, scheduled for a date and time, or held; it shows which.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import { PostCard } from './PulseReviewPost';

const DRAFT = { id: 'p1', status: 'draft', content_text: 'counting down to the swap.', poster_handle: 'slowsift', poster_display_name: 'Maren' };
const card = (post, onChange = () => {}) => render(<MemoryRouter><PostCard post={post} onChange={onChange} /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
});

describe('release time', () => {
  test('schedule picks a date and time and sends it; hold holds', async () => {
    const onChange = vi.fn();
    card(DRAFT, onChange);
    const box = screen.getByTestId('prv-release');
    fireEvent.click(within(box).getByText('Schedule…'));
    fireEvent.change(within(box).getByLabelText('Release on'), { target: { value: '2030-01-02T09:30' } });
    fireEvent.click(within(box).getByText('Schedule'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/p1/release-time',
      { mode: 'schedule', at: new Date('2030-01-02T09:30').toISOString() }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    fireEvent.click(within(box).getByText('Hold'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/p1/release-time', { mode: 'hold' }));
  });

  test('a scheduled draft says when, and can be released now or unscheduled', async () => {
    card({ ...DRAFT, release_state: 'scheduled', release_at: '2030-01-02T09:30:00Z' });
    const box = screen.getByTestId('prv-release');
    expect(within(box).getByText(/^Scheduled for /)).toBeTruthy();
    expect(within(box).getByText('Reschedule')).toBeTruthy();
    fireEvent.click(within(box).getByText('Unschedule'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/p1/release-time', { mode: 'clear' }));
    fireEvent.click(screen.getByText('Release now'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/p1', { status: 'live' }));
  });

  test('a held draft says so and can stop holding', async () => {
    card({ ...DRAFT, release_state: 'held' });
    const box = screen.getByTestId('prv-release');
    expect(within(box).getByText('Held')).toBeTruthy();
    expect(within(box).queryByText('Hold')).toBeNull();
    fireEvent.click(within(box).getByText('Stop holding'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/p1/release-time', { mode: 'clear' }));
  });
});
