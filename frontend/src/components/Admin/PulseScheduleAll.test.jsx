/**
 * Schedule all (Evoni, 2026-10-17): Review's drafts with no release time,
 * each at the time the story suggests; she changes any time, schedules
 * them; a time that breaks the story order is skipped until "Schedule them
 * anyway".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import PulseScheduleAll from './PulseScheduleAll';

const PLAN = {
  items: [
    { post_id: 'a', handle: 'slowsift', text: 'the swap is next week.', story: 'Announced Ep 3', post_weight: 'load_bearing', at: '2030-03-01T12:00:00.000Z', why: 'A week before Episode 3 airs', problems: [] },
    { post_id: 'b', handle: 'kai', text: 'replying to maren.', story: 'Announced Ep 3', post_weight: null, at: '2030-03-01T12:15:00.000Z', why: 'A week before Episode 3 airs; moved to keep the story in order', problems: [] },
  ],
  total: 2,
};
const local = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: PLAN });
});

describe('Schedule all', () => {
  test('no drafts: the button is off', () => {
    render(<PulseScheduleAll showId="s1" drafts={0} />);
    expect(screen.getByText('Schedule all drafts at suggested times').disabled).toBe(true);
  });

  test('shows the plan in story order, takes her changes, and schedules them', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { scheduled: ['a', 'b'], skipped: [], failed: [] } });
    const onChange = vi.fn();
    render(<PulseScheduleAll showId="s1" drafts={2} onChange={onChange} />);
    fireEvent.click(screen.getByText('Schedule all drafts at suggested times'));
    const items = await screen.findAllByTestId('prv-plan-item');
    expect(items).toHaveLength(2);
    expect(api.get).toHaveBeenCalledWith(`/api/v1/feed-posts/release-plan?show_id=s1&tz_offset=${new Date().getTimezoneOffset()}`);
    expect(items[0].textContent).toContain('A week before Episode 3 airs');
    expect(screen.getByLabelText('Release @slowsift on').value).toBe(local(PLAN.items[0].at));
    fireEvent.change(screen.getByLabelText('Release @kai on'), { target: { value: '2030-03-02T18:00' } });
    fireEvent.click(screen.getByText('Schedule these 2'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts/release-plan', {
      items: [
        { post_id: 'a', at: PLAN.items[0].at },
        { post_id: 'b', at: new Date('2030-03-02T18:00').toISOString() },
      ],
      tz_offset: new Date().getTimezoneOffset(),
      anyway: false,
    }));
    expect((await screen.findByTestId('prv-schedule-all-done')).textContent).toBe('Scheduled 2.');
    expect(onChange).toHaveBeenCalled();
    expect(screen.queryAllByTestId('prv-plan-item')).toHaveLength(0);
  });

  test('a time that breaks the story order is skipped with why, until Schedule them anyway', async () => {
    const problems = ['Too early: it answers @slowsift\'s post, which goes out Fri 1 Mar, 12:00.'];
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { scheduled: ['a'], skipped: [{ post_id: 'b', problems }], failed: [] } })
      .mockResolvedValueOnce({ data: { scheduled: ['b'], skipped: [], failed: [] } });
    render(<PulseScheduleAll showId="s1" drafts={2} onChange={() => {}} />);
    fireEvent.click(screen.getByText('Schedule all drafts at suggested times'));
    await screen.findAllByTestId('prv-plan-item');
    fireEvent.click(screen.getByText('Schedule these 2'));
    expect((await screen.findByTestId('prv-plan-problems')).textContent).toContain('answers @slowsift');
    expect(screen.getAllByTestId('prv-plan-item')).toHaveLength(1);
    fireEvent.click(screen.getByText('Schedule them anyway'));
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/api/v1/feed-posts/release-plan', {
      items: [{ post_id: 'b', at: PLAN.items[1].at }], tz_offset: new Date().getTimezoneOffset(), anyway: true,
    }));
    await waitFor(() => expect(screen.queryAllByTestId('prv-plan-item')).toHaveLength(0));
  });
});
