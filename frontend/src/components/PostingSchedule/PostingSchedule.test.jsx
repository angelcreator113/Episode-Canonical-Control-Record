/**
 * Evoni, 2026-10-18: each character posts on a schedule that fits who they
 * are; it is suggested until she saves her own.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import PostingSchedule from './PostingSchedule';

const suggestion = {
  schedule: { days: ['tue', 'sat'], windows: [{ start: '07:00', end: '09:30' }], per_week: 2, source: 'suggested' },
  why: 'Tue/Sat mornings: a slow, at-home creator posts in the quiet of the morning.',
};

describe('PostingSchedule', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, schedule: null, suggestion } });
  });

  test('with none saved it shows the suggestion and says so', async () => {
    render(<PostingSchedule profileId={7} />);
    expect(await screen.findByTestId('posting-schedule-suggested')).toBeTruthy();
    expect(screen.getByText(/a slow, at-home creator/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tue' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Mon' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('Window 1 start').value).toBe('07:00');
  });

  test('Save sends the schedule with her time zone', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, schedule: { ...suggestion.schedule, days: ['mon', 'tue', 'sat'], source: 'set' } } });
    render(<PostingSchedule profileId={7} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/social-profiles/7/posting-schedule');
    expect(body.schedule.days).toEqual(['tue', 'sat', 'mon']);
    expect(body.schedule.tz_offset).toBe(new Date().getTimezoneOffset());
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.queryByTestId('posting-schedule-suggested')).toBeNull();
  });

  test('Suggest fills the form and shows why', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, schedule: { days: ['fri'], windows: [{ start: '20:00', end: '23:00' }], per_week: 1, source: 'set' }, suggestion } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, ...suggestion } });
    render(<PostingSchedule profileId={7} />);
    fireEvent.click(await screen.findByRole('button', { name: /Suggest from who they are/ }));
    await screen.findByText(/a slow, at-home creator/);
    expect(screen.getByLabelText('Window 1 start').value).toBe('07:00');
    expect(api.post).toHaveBeenCalledWith('/api/v1/social-profiles/7/posting-schedule/suggest');
  });
});
