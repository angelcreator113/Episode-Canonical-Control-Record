/**
 * Admin › The Pulse › Calendar (Task 2988): the story moments by episode,
 * each row's counts with Show for its items, a link to The Pulse then, and
 * Review when something waits; nothing yet, unplaced items, and an error.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../services/api';
import PulseCalendar, { countsLine, byEpisode } from './PulseCalendar';

const moment = (order, label, parts = {}) => ({ order, label, posts: [], reveals: [], events: [], closeness: [], dms: [], ...parts });
const DATA = {
  success: true,
  unplaced: { posts: 2, reveals: 1 },
  moments: [
    moment(7, 'Backstory', { posts: [{ id: 'p0', status: 'live', poster_handle: 'lala', text: 'before it all' }] }),
    moment(12, 'Announced Ep 1', { reveals: [{ id: 'r1', item_type: 'event', item_id: 'e1', moment: 'announced', mode: 'hidden' }] }),
    moment(15, 'During Ep 1', { events: [{ id: 'e1', name: 'The Gala', episode_number: 1, date: 'Friday, March 15th', time: '9pm', venue: 'The Glasshouse' }] }),
    moment(17, 'After Ep 1', {
      posts: [{ id: 'p1', status: 'live', poster_handle: 'marcus.k', text: 'the gala was a whole moment' }, { id: 'p2', status: 'draft', poster_handle: 'lala', text: 'still thinking' }],
      closeness: [{ id: 'c1', a: 'lala', b: 'marcus.k', delta: 0.03, cause: 'comment', status: 'proposed' }],
      dms: [{ id: 'd1', sender: 'lala', status: 'draft', text: 'u up?' }],
    }),
  ],
};

const renderIt = () => render(<MemoryRouter><PulseCalendar showId="show-1" /></MemoryRouter>);

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockResolvedValue({ data: DATA });
});

describe('helpers', () => {
  test('countsLine says what a moment holds, drafts apart', () => {
    expect(countsLine(DATA.moments[3])).toBe('2 posts (1 draft) · 1 closeness change · 1 DM');
    expect(countsLine(DATA.moments[2])).toBe('1 event');
  });
  test('byEpisode groups moments by episode, the backstory as 0', () => {
    expect(byEpisode(DATA.moments).map((g) => [g.episode, g.moments.map((m) => m.order)])).toEqual([[0, [7]], [1, [12, 15, 17]]]);
  });
});

describe('the Calendar tab', () => {
  test('reads the calendar once; moments by episode, in order, with their counts', async () => {
    renderIt();
    const rows = await screen.findAllByTestId('pulse-cal-row');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-calendar?show_id=show-1');
    expect(screen.getByRole('heading', { name: 'Backstory' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Episode 1' })).toBeTruthy();
    expect(rows.map((r) => r.querySelector('.pulse-cal-label').textContent)).toEqual(['Backstory', 'Announced Ep 1', 'During Ep 1', 'After Ep 1']);
    expect(screen.getByTestId('pulse-cal-unplaced').textContent).toBe('Not in story time yet: 2 posts and 1 reveal.');
  });

  test('Show opens a row: the event with its date as written, posts (drafts marked), closeness and DMs; links to The Pulse then and to Review', async () => {
    renderIt();
    const rows = await screen.findAllByTestId('pulse-cal-row');
    const during = rows[2];
    fireEvent.click(within(during).getByRole('button', { name: 'Show' }));
    expect(within(during).getByTestId('pulse-cal-items').textContent).toBe('Event The Gala · Friday, March 15th 9pm · The Glasshouse');
    expect(within(during).queryByRole('link', { name: 'Review' })).toBeNull();
    expect(within(during).getByRole('link', { name: 'See The Pulse then' }).getAttribute('href')).toBe('/pulse?at=15');

    const after = rows[3];
    fireEvent.click(within(after).getByRole('button', { name: 'Show' }));
    const items = within(within(after).getByTestId('pulse-cal-items')).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      'Post @marcus.k: the gala was a whole moment',
      'Draft @lala: still thinking',
      'Closeness @lala ↔ @marcus.k +3 (waiting)',
      'DM draft @lala: u up?',
    ]);
    expect(within(after).getByRole('link', { name: 'Review' }).getAttribute('href')).toBe('/admin?tab=pulse&sub=review');
    fireEvent.click(within(after).getByRole('button', { name: 'Hide' }));
    expect(within(after).queryByTestId('pulse-cal-items')).toBeNull();

    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Show' }));
    expect(within(rows[1]).getByTestId('pulse-cal-items').textContent).toBe('Reveal Event revealed');
  });

  test('nothing yet, and an error, say so', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { moments: [], unplaced: { posts: 0, reveals: 0 } } });
    const { unmount } = renderIt();
    expect((await screen.findByTestId('pulse-cal-empty')).textContent).toBe('Nothing in story time yet.');
    expect(screen.queryByTestId('pulse-cal-unplaced')).toBeNull();
    unmount();
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 500 } });
    renderIt();
    expect((await screen.findByRole('alert')).textContent).toBe('The calendar could not be loaded.');
  });
});
