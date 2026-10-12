/**
 * Admin › The Pulse › Growth (Task 2957): Lala's follower line (accepted
 * solid, proposed dashed), best and worst posts, biggest jumps with causes,
 * a text summary for screen readers, the empty state, and confirming her
 * starting count.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import PulseGrowth, { chartPoints, causeText, shortMoment } from './PulseGrowth';

const LINE = [
  { id: 's', label: 'Start', story_order: 0, count: 50000, change: 50000, cause: 'start', status: 'accepted' },
  { id: 'a', label: 'After Ep 1', story_order: 17, count: 54000, change: 4000, cause: 'episode', episode_number: 1, status: 'accepted' },
  { id: 'b', label: 'After Ep 2', story_order: 27, count: 62500, change: 8500, cause: 'episode', episode_number: 2, status: 'accepted' },
];
const GROWTH = {
  success: true,
  profile: { id: 7, handle: 'lala', display_name: 'Lala', follower_tier: 'mid' },
  start: { ...LINE[0] },
  line: LINE,
  projection: [{ id: 'p', label: 'After Ep 3', story_order: 37, count: 65000, change: 2500, cause: 'episode', episode_number: 3, status: 'proposed' }],
  best: [{ post_id: 'x1', likes: 5000, shares: 500, status: 'viral', content_text: 'The gold one.' }, { post_id: 'x2', likes: 2000, shares: 200, status: 'accepted', content_text: 'Studio day.' }],
  worst: [{ post_id: 'x3', likes: 50, shares: 5, status: 'flop', content_text: 'Rain.' }],
  jumps: [{ id: 'b', label: 'After Ep 2', change: 8500, cause: 'episode', episode_number: 2 }, { id: 'o', label: 'The day after Ep 1', change: -500, cause: 'override', reason: 'A quiet day.' }],
};

const renderGrowth = (data) => {
  vi.mocked(api.get).mockResolvedValue({ data });
  return render(<MemoryRouter><PulseGrowth showId="show-1" chartWidth={600} /></MemoryRouter>);
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('helpers', () => {
  test('chart points: the accepted counts, then the projection joined at the latest accepted point', () => {
    expect(chartPoints(LINE, GROWTH.projection)).toEqual([
      { label: 'Start', short: 'Start', count: 50000 },
      { label: 'After Ep 1', short: 'Ep 1', count: 54000 },
      { label: 'After Ep 2', short: 'Ep 2', count: 62500, projected: 62500 },
      { label: 'After Ep 3', short: 'Ep 3', projected: 65000 },
    ]);
    expect(chartPoints(LINE, [])).toHaveLength(3);
    expect(chartPoints([], GROWTH.projection)).toEqual([]);
  });

  test('short axis labels for a phone', () => {
    expect([0, 17, 18, 19, 25].map((o) => shortMoment({ cause: 'episode', story_order: o }))).toEqual(['Start', 'Ep 1', '+1 day', '+1 week', 'Ep 2 ·']);
    expect(shortMoment({ cause: 'start', story_order: 0 })).toBe('Start');
  });

  test('causes in words', () => {
    expect(causeText({ cause: 'episode', episode_number: 2 })).toBe('Episode 2 result');
    expect(causeText({ cause: 'override', reason: 'A quiet day.' })).toBe('Set by hand: A quiet day.');
    expect(causeText({ cause: 'post' })).toBe('A post');
    expect(causeText({ cause: 'event' })).toBe('An event');
  });
});

describe('the Growth tab', () => {
  test('reads the growth for the show; a summary with the count and tier, no Influence', async () => {
    renderGrowth(GROWTH);
    const summary = await screen.findByTestId('pulse-growth-summary');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-followers/growth?show_id=show-1');
    expect(summary.textContent).toBe('@lala has 62,500 followers · mid tier, +12,500 since her start. One episode change waits in Review.');
    expect(within(summary).getByRole('link', { name: 'Review' }).getAttribute('href')).toBe('/admin?tab=pulse&sub=review');
    expect(screen.queryByText(/influence/i)).toBeNull();
    expect(screen.getByTestId('pulse-growth-start').textContent).toBe('Started at 50,000 followers.');
  });

  test('the line: accepted solid, proposed dashed; the points as text for screen readers', async () => {
    renderGrowth(GROWTH);
    const chart = await screen.findByTestId('pulse-growth-chart');
    await waitFor(() => expect(chart.querySelectorAll('.recharts-line-curve')).toHaveLength(2));
    const solid = chart.querySelector('.pulse-growth-accepted .recharts-line-curve');
    const dashed = chart.querySelector('.pulse-growth-projection .recharts-line-curve');
    expect(solid.getAttribute('stroke-dasharray')).toBeNull();
    expect(dashed.getAttribute('stroke-dasharray')).toBe('6 4');
    expect(chart.getAttribute('aria-hidden')).toBe('true');
    expect(within(screen.getByTestId('pulse-growth-points')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Start: 50,000 followers', 'After Ep 1: 54,000 followers', 'After Ep 2: 62,500 followers', 'After Ep 3: 65,000 followers, proposed',
    ]);
  });

  test('best and worst posts, and the biggest jumps with their causes', async () => {
    renderGrowth(GROWTH);
    const best = await screen.findByTestId('pulse-growth-best');
    expect(within(best).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['5,000 likesThe gold one.Made viral', '2,000 likesStudio day.']);
    expect(within(screen.getByTestId('pulse-growth-worst')).getByRole('listitem').textContent).toBe('50 likesRain.Made a flop');
    expect(within(screen.getByTestId('pulse-growth-jumps')).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['+8,500After Ep 2 · Episode 2 result', '−500The day after Ep 1 · Set by hand: A quiet day.']);
  });

  test('empty: no Feed profile for Lala; and with a profile but nothing yet, no chart and quiet lists', async () => {
    const { unmount } = renderGrowth({ success: true, profile: null, start: null, line: [], projection: [], best: [], worst: [], jumps: [] });
    expect((await screen.findByTestId('pulse-growth-empty')).textContent).toMatch(/no Feed profile/);
    unmount();
    renderGrowth({ ...GROWTH, start: null, line: [], projection: [], best: [], worst: [], jumps: [] });
    expect((await screen.findByTestId('pulse-growth-summary')).textContent).toBe('No accepted follower count for @lala yet · mid tier.');
    expect(screen.queryByTestId('pulse-growth-chart')).toBeNull();
    expect(within(screen.getByTestId('pulse-growth-best')).getByText('No decided numbers yet.')).toBeTruthy();
    expect(within(screen.getByTestId('pulse-growth-jumps')).getByText('No changes since her start yet.')).toBeTruthy();
  });

  test('a proposed start is confirmed here, then the growth reloads', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    renderGrowth({ ...GROWTH, start: { id: 's1', label: 'Start', count: 47000, status: 'proposed', reason: 'Proposed from the estimate "47k".' }, line: [], projection: [] });
    const start = await screen.findByTestId('pulse-growth-start');
    expect(start.textContent).toMatch(/proposed at 47,000/);
    fireEvent.click(within(start).getByRole('button', { name: 'Confirm 47,000' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-followers/s1/accept'));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  test('with no start at all, starting counts are proposed for the show', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, created: 4, waiting: 1 } });
    renderGrowth({ ...GROWTH, start: null, line: [], projection: [] });
    fireEvent.click(await screen.findByRole('button', { name: 'Propose starting counts' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-followers/starts', { show_id: 'show-1' }));
  });

  test("an error reading the growth is shown", async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } });
    render(<MemoryRouter><PulseGrowth showId="show-1" chartWidth={600} /></MemoryRouter>);
    expect((await screen.findByRole('alert')).textContent).toBe('Growth could not be loaded.');
  });
});
