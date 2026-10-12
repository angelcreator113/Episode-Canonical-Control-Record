/**
 * Admin › The Pulse › Polls (Task 3006): the polls with their status, votes
 * so far while open and counts once closed; Open and Close; a new poll about
 * an event with options from the wardrobe or the event's planned outfit; the
 * note when voting is off on the server; errors.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import PulsePolls, { plannedIds } from './PulsePolls';

const W1 = '11111111-1111-4111-8111-111111111111';
const W2 = '22222222-2222-4222-8222-222222222222';
const W3 = '33333333-3333-4333-8333-333333333333';
const EVENT = { id: 'ev-1', name: 'The Gala', outfit_pieces: [W1, { id: W2 }, { name: 'inline, no id' }] };
const POLLS = [
  { id: 'p-open', world_event_id: 'ev-1', question: 'Pink or black?', status: 'open', total: 3, closes_at: null,
    options: [{ id: 'o1', label: 'Pink', wardrobe_ids: [W1, W2], votes: 2 }, { id: 'o2', label: 'Black', wardrobe_ids: [W3], votes: 1 }] },
  { id: 'p-closed', world_event_id: 'ev-1', question: 'Heels or flats?', status: 'closed', total: 5,
    options: [{ id: 'o3', label: 'Heels', wardrobe_ids: [W1], votes: 4 }, { id: 'o4', label: 'Flats', wardrobe_ids: [], votes: 1 }] },
  { id: 'p-draft', world_event_id: null, question: 'Hat?', status: 'draft', total: 0,
    options: [{ id: 'o5', label: 'Yes', wardrobe_ids: [], votes: 0 }, { id: 'o6', label: 'No', wardrobe_ids: [], votes: 0 }] },
];
const WARDROBE = [{ id: W1, name: 'Pink blazer' }, { id: W2, name: 'Pink skirt' }, { id: W3, name: 'Black dress' }];

const route = (url, { polls = POLLS, ready = true } = {}) => {
  if (url.startsWith('/api/v1/pulse-polls')) return Promise.resolve({ data: { success: true, polls, voting_ready: ready } });
  if (url.startsWith('/api/v1/world/')) return Promise.resolve({ data: { success: true, events: [EVENT] } });
  if (url.startsWith('/api/v1/wardrobe')) return Promise.resolve({ data: { success: true, data: WARDROBE } });
  return Promise.reject(new Error(`unexpected ${url}`));
};

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.get).mockImplementation((url) => route(url));
});

describe('plannedIds', () => {
  test("keeps the ids in an event's planned outfit, ids or pieces with one", () => {
    expect(plannedIds(EVENT)).toEqual([W1, W2]);
    expect(plannedIds({})).toEqual([]);
  });
});

describe('the Polls tab', () => {
  test('lists the polls: votes so far while open, counts once closed, Open on a draft', async () => {
    render(<PulsePolls showId="show-1" />);
    const cards = await screen.findAllByTestId('pulse-poll-card');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-polls?show_id=show-1');
    const [open, closed, draft] = cards;
    expect(within(open).getByTestId('pulse-poll-so-far').textContent).toBe('3 votes so far');
    expect(within(open).queryByText('2 votes')).toBeNull();
    expect(await within(open).findByText('About The Gala.')).toBeTruthy();
    expect(within(closed).getByText('4 votes')).toBeTruthy();
    expect(within(closed).getByText('5 votes in all.')).toBeTruthy();
    expect(within(draft).getByRole('button', { name: 'Open' })).toBeTruthy();
    expect(screen.queryByTestId('pulse-poll-not-ready')).toBeNull();
  });

  test('Open and Close call the API and reload; a refusal shows', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } })
      .mockRejectedValueOnce({ response: { status: 409, data: { error: 'This poll is already closed.' } } });
    render(<PulsePolls showId="show-1" />);
    const [open, , draft] = await screen.findAllByTestId('pulse-poll-card');
    fireEvent.click(within(draft).getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-polls/p-draft/open', {}));
    await waitFor(() => expect(api.get.mock.calls.filter(([u]) => u.startsWith('/api/v1/pulse-polls')).length).toBe(2));
    fireEvent.click(within(open).getByRole('button', { name: 'Close' }));
    expect((await within(open).findByRole('alert')).textContent).toBe('This poll is already closed.');
  });

  test("a new poll: the event, the default question, options from the wardrobe and the event's planned outfit", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    render(<PulsePolls showId="show-1" />);
    await screen.findAllByTestId('pulse-poll-card');
    fireEvent.click(screen.getByRole('button', { name: 'New poll' }));
    const form = screen.getByTestId('pulse-poll-new');
    const save = within(form).getByRole('button', { name: 'Save as draft' });
    expect(save.disabled).toBe(true);
    await waitFor(() => expect(within(form).getAllByRole('option', { name: 'The Gala' })).toHaveLength(1));
    fireEvent.change(within(form).getByLabelText('Event'), { target: { value: 'ev-1' } });
    expect(within(form).getByLabelText('Question').getAttribute('placeholder')).toBe('Which look for The Gala?');

    const [first, second] = within(form).getAllByTestId('pulse-poll-option');
    fireEvent.change(within(first).getByLabelText('Option 1'), { target: { value: 'The pink set' } });
    fireEvent.click(within(first).getByRole('button', { name: "Use the event's planned outfit" }));
    const chips = (el) => [...el.querySelectorAll('.pulse-poll-pieces li')].map((li) => li.firstChild.textContent);
    expect(chips(first)).toEqual(['Pink blazer', 'Pink skirt']);
    fireEvent.change(within(second).getByLabelText('Option 2'), { target: { value: 'The black dress' } });
    fireEvent.change(within(second).getByLabelText('Add a piece'), { target: { value: W3 } });
    expect(chips(second)).toEqual(['Black dress']);
    expect(within(form).queryByRole('button', { name: 'Remove option' })).toBeNull();
    fireEvent.click(within(form).getByRole('button', { name: 'Add an option' }));
    expect(within(form).getAllByTestId('pulse-poll-option')).toHaveLength(3);
    fireEvent.click(within(form).getAllByRole('button', { name: 'Remove option' })[2]);
    expect(within(form).getAllByTestId('pulse-poll-option')).toHaveLength(2);

    fireEvent.click(save);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-polls', {
      show_id: 'show-1', world_event_id: 'ev-1',
      options: [{ label: 'The pink set', wardrobe_ids: [W1, W2] }, { label: 'The black dress', wardrobe_ids: [W3] }],
    }));
    await waitFor(() => expect(screen.queryByTestId('pulse-poll-new')).toBeNull());
  });

  test('voting off on the server says so; none yet; a failed read', async () => {
    vi.mocked(api.get).mockImplementation((url) => route(url, { polls: [], ready: false }));
    const { unmount } = render(<PulsePolls showId="show-1" />);
    expect((await screen.findByTestId('pulse-poll-not-ready')).textContent).toMatch(/POLL_HASH_SALT/);
    expect(screen.getByTestId('pulse-poll-empty').textContent).toBe('No polls yet.');
    unmount();
    vi.mocked(api.get).mockImplementation(() => Promise.reject({ response: { status: 500 } }));
    render(<PulsePolls showId="show-1" />);
    expect((await screen.findByRole('alert')).textContent).toBe('The polls could not be loaded.');
  });
});
