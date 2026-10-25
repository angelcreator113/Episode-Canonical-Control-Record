/**
 * The Release tab with the show's release schedule (Evoni, 2026-10-25): the
 * next release dated "Sun, Nov 1 · 10:00 AM (from the weekly schedule)", the
 * deadline warning from its checklist, the calendar's dates, one episode
 * overridden by hand with "Back to the schedule", and the not-releasing-yet
 * preview that never warns.
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import ReleaseBoard from './ReleaseBoard';

const SCHEDULE = { day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-11-01', paused: false, tz_offset: 240, tz: 'America/New_York' };
const episodes = [
  { id: 'e1', episode_number: 1, title: 'Studio', status: 'published' },
  { id: 'e2', episode_number: 2, title: 'Gala Night', status: 'in_build' },
  { id: 'e3', episode_number: 3, title: 'Rooftop', status: 'draft', air_date: '2026-11-14' },
];
const row = (id, n, date, source, over = {}) => ({ episode_id: id, episode_number: n, date, time: '10:00', source, due: 'later', days_until: 9, ...over });
const ACTIVE = {
  schedule: SCHEDULE, state: 'active', suggestion: null,
  episodes: [
    row('e1', 1, '2026-10-25', 'schedule', { status: 'published', due: 'released' }),
    row('e2', 2, '2026-11-01', 'schedule', { due: 'soon', days_until: 2 }),
    row('e3', 3, '2026-11-14', 'hand'),
  ],
  slots: {},
};
const wrap = () => render(<MemoryRouter><ReleaseBoard showId="show-1" episodes={episodes} history={[]} /></MemoryRouter>);

function mockApi(view) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/world/show-1/release-schedule') return { data: { success: true, data: view } };
    if (url === '/api/v1/episodes/e2') return { data: { data: { id: 'e2', title: 'Gala Night', status: 'in_build', title_approved_at: 'x', title_approved_value: 'Gala Night' } } };
    if (url === '/api/v1/feed-posts/episode/e2') return { data: { data: [] } };
    return { data: {} };
  });
}

describe('Release tab with the weekly schedule', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  test('the next release is dated from the schedule and warns what it still needs', async () => {
    mockApi(ACTIVE);
    wrap();
    const when = await screen.findByText('Goes live Sun, Nov 1 · 10:00 AM (from the weekly schedule)');
    expect(when).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('release-deadline').textContent)
      .toBe('Episode 2 releases in 2 days and still needs: final cut, thumbnail, title & copy, pulse posts.'));
    expect(screen.getByTestId('release-deadline').className).toContain('is-soon');
    expect(within(screen.getByTestId('release-ready-schedule')).getByText('Sun, Nov 1 · 10:00 AM')).toBeTruthy();
    expect(screen.getByTestId('release-schedule-sentence').textContent).toBe('Releases on YouTube every Sunday at 10:00 AM');
    expect(screen.getByTestId('release-schedule-start').textContent).toBe('Starts releasing Sun, Nov 1');
  });

  test('an overdue episode says so', async () => {
    mockApi({ ...ACTIVE, episodes: [ACTIVE.episodes[0], row('e2', 2, '2026-11-01', 'schedule', { due: 'overdue', days_until: -1 }), ACTIVE.episodes[2]] });
    wrap();
    await waitFor(() => expect(screen.getByTestId('release-deadline').textContent)
      .toMatch(/^Episode 2 was due Sun, Nov 1 · 10:00 AM and is not released yet\. It still needs: /));
    expect(screen.getByTestId('release-deadline').className).toContain('is-overdue');
  });

  test('the calendar shows each date, and a hand-set one goes back to the schedule', async () => {
    mockApi(ACTIVE);
    const after = { ...ACTIVE, episodes: [ACTIVE.episodes[0], ACTIVE.episodes[1], row('e3', 3, '2026-11-08', 'schedule')] };
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: after } });
    wrap();
    const e3 = await screen.findByTestId('release-cal-e3');
    expect(e3.textContent).toContain('Scheduled · Sat, Nov 14 · 10:00 AM (set by hand)');
    expect(within(e3).getByText('Set by hand')).toBeTruthy();
    expect(screen.getByTestId('release-cal-e2').textContent).toContain('Scheduled · Sun, Nov 1 · 10:00 AM (from the weekly schedule)');

    fireEvent.click(within(e3).getByTestId('release-date-back-e3'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/episodes/e3/release-date', { air_date: null }));
    await waitFor(() => expect(screen.getByTestId('release-cal-e3').textContent).toContain('Sun, Nov 8 · 10:00 AM (from the weekly schedule)'));
    expect(screen.queryByTestId('release-date-back-e3')).toBeNull();
  });

  test("one episode's date is changed by hand", async () => {
    mockApi(ACTIVE);
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: ACTIVE } });
    wrap();
    fireEvent.click(await screen.findByTestId('release-date-change-e2'));
    fireEvent.change(screen.getByTestId('release-date-input-e2'), { target: { value: '2026-11-02' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/episodes/e2/release-date', { air_date: '2026-11-02' }));
  });

  test('not releasing yet: dates are previews and nothing warns', async () => {
    mockApi({
      ...ACTIVE, state: 'preview', schedule: { ...SCHEDULE, first_release: null },
      episodes: [row('e2', 2, '2026-11-01', 'preview', { due: null, days_until: null }), row('e3', 3, '2026-11-14', 'hand', { due: null })],
    });
    wrap();
    await waitFor(() => expect(screen.getByTestId('release-next-when').textContent).toBe('Not releasing yet · Would be Sun, Nov 1 · 10:00 AM'));
    expect(screen.getByTestId('release-cal-e2').textContent).toContain('Not releasing yet · Would be Sun, Nov 1 · 10:00 AM');
    expect(screen.getByTestId('release-schedule-start').textContent).toBe('Not releasing yet: the dates below are previews');
    expect(screen.queryByTestId('release-deadline')).toBeNull();
    expect(screen.getByTestId('release-ready-schedule').className).toContain('state-todo');
  });

  test('with no schedule the board is as before', async () => {
    mockApi({ schedule: null, state: 'unset', suggestion: SCHEDULE, episodes: [row('e3', 3, '2026-11-14', 'hand', { time: null, due: null })], slots: {} });
    wrap();
    expect(await screen.findByText('No release schedule yet')).toBeTruthy();
    expect(screen.getByText('No go-live date yet')).toBeTruthy();
    expect(screen.queryByTestId('release-deadline')).toBeNull();
    expect(screen.queryByTestId('release-date-back-e3')).toBeNull();
  });
});
