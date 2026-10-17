/**
 * Release calendar (Evoni, 2026-10-17): scheduled drafts by day; drag one to
 * another day, or pick it and "Move here", keeping its hour; a day that
 * breaks the story order waits for "Move anyway".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import PulseReleaseCalendar, { onDay } from './PulseReleaseCalendar';

const at = (daysAhead, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + daysAhead); d.setHours(h, m, 0, 0); return d; };
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const POSTS = [
  { post_id: 'a', handle: 'slowsift', text: 'the swap is next week.', story: 'Announced Ep 3', post_weight: 'load_bearing', release_at: at(2, 18, 30).toISOString() },
  { post_id: 'b', handle: 'kai', text: 'see you there', story: 'Before Ep 3', post_weight: null, release_at: at(4, 12).toISOString() },
];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: { posts: POSTS } });
  vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
});

describe('release calendar', () => {
  test('onDay keeps the hour and minute', () => {
    const moved = onDay(at(2, 18, 30).toISOString(), at(5, 0));
    expect([moved.getDate(), moved.getHours(), moved.getMinutes()]).toEqual([at(5, 0).getDate(), 18, 30]);
  });

  test('shows only the days with posts, each post with its time, poster and story time', async () => {
    render(<PulseReleaseCalendar showId="s1" />);
    const days = await screen.findAllByTestId('prv-calendar-day');
    expect(days.map((d) => d.dataset.day)).toEqual([key(at(2, 0)), key(at(4, 0))]);
    expect(within(days[0]).getByTestId('prv-calendar-post').textContent).toContain('18:30');
    expect(within(days[0]).getByTestId('prv-calendar-post').textContent).toContain('Announced Ep 3');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts/release-calendar?show_id=s1');
  });

  test('pick a post, then Move here on another day: it keeps its hour', async () => {
    const onChange = vi.fn();
    render(<PulseReleaseCalendar showId="s1" onChange={onChange} />);
    fireEvent.click((await screen.findAllByTestId('prv-calendar-post'))[0]);
    const target = screen.getAllByTestId('prv-calendar-day').find((d) => d.dataset.day === key(at(6, 0)));
    fireEvent.click(within(target).getByText('Move here'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/a/release-time',
      { mode: 'schedule', at: at(6, 18, 30).toISOString(), tz_offset: new Date().getTimezoneOffset(), anyway: false }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  test('a drop on a day moves the dragged post there', async () => {
    render(<PulseReleaseCalendar showId="s1" />);
    const post = (await screen.findAllByTestId('prv-calendar-post'))[1];
    const data = { value: '', setData(_, v) { this.value = v; }, getData() { return this.value; } };
    fireEvent.dragStart(post, { dataTransfer: data });
    const target = screen.getAllByTestId('prv-calendar-day').find((d) => d.dataset.day === key(at(3, 0)));
    fireEvent.drop(target, { dataTransfer: data });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/b/release-time',
      expect.objectContaining({ mode: 'schedule', at: at(3, 12).toISOString(), anyway: false })));
  });

  test('a day that breaks the story order says why, and waits for Move anyway', async () => {
    const problems = ['Too late: it is load-bearing, so it goes out before Episode 3 airs (Sat 7 Mar, 00:00).'];
    vi.mocked(api.put).mockRejectedValueOnce({ response: { status: 409, data: { error: 'This time breaks the story order.', problems } } });
    render(<PulseReleaseCalendar showId="s1" />);
    fireEvent.click((await screen.findAllByTestId('prv-calendar-post'))[0]);
    const target = screen.getAllByTestId('prv-calendar-day').find((d) => d.dataset.day === key(at(10, 0)));
    fireEvent.click(within(target).getByText('Move here'));
    expect((await screen.findByTestId('prv-calendar-problems')).textContent).toContain('load-bearing');
    fireEvent.click(screen.getByText('Move anyway'));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/api/v1/feed-posts/a/release-time',
      expect.objectContaining({ at: at(10, 18, 30).toISOString(), anyway: true })));
  });
});
