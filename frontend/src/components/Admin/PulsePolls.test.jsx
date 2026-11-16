/**
 * Admin › The Pulse › Polls (Task 3006): the polls with their status, votes
 * so far while open and counts once closed; Open and Close; a new poll about
 * an event with options from the wardrobe or the event's planned outfit; the
 * note when voting is off on the server; errors.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import { MemoryRouter } from 'react-router-dom';
import PulsePolls, { plannedIds, missingFor, localInput, PULSE_PATH } from './PulsePolls';

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
  vi.mocked(api.put).mockReset();
  vi.mocked(api.delete).mockReset();
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

describe('poll usability (2026-11-15)', () => {
  const DRAFT = { id: 'p-d', world_event_id: 'ev-1', question: 'Hat or no hat?', status: 'draft', total: 0, closes_at: null,
    options: [{ id: 'o7', label: 'Hat', wardrobe_ids: [W1], votes: 0 }, { id: 'o8', label: 'No hat', wardrobe_ids: [], votes: 0 }] };
  const serve = (opts) => vi.mocked(api.get).mockImplementation((url) => route(url, opts));
  const draftCard = async () => {
    const cards = await screen.findAllByTestId('pulse-poll-card');
    return cards[cards.length - 1];
  };

  test('missingFor says what a Save is waiting for', () => {
    const o = (label) => ({ label, wardrobe_ids: [] });
    expect(missingFor({ needsEvent: true, eventId: '', options: [o('a'), o('b')] })).toBe('Choose an event to save.');
    expect(missingFor({ needsEvent: true, eventId: 'ev', options: [o('a'), o(' ')] })).toBe('Option 2 needs a label to save.');
    expect(missingFor({ needsEvent: false, options: [o(''), o('b'), o('')] })).toBe('Options 1 and 3 need a label to save.');
    expect(missingFor({ needsEvent: true, eventId: 'ev', options: [o('a'), o('b')] })).toBeNull();
  });

  test('localInput: a stored time as the field shows it; nothing for none or a bad one', () => {
    expect(localInput(null)).toBe('');
    expect(localInput('not a date')).toBe('');
    const d = new Date(2027, 0, 5, 9, 7);
    expect(localInput(d.toISOString())).toBe('2027-01-05T09:07');
  });

  test('a new poll says why Save as draft is off, and stops saying it once it can save', async () => {
    render(<PulsePolls showId="show-1" />);
    await screen.findAllByTestId('pulse-poll-card');
    fireEvent.click(screen.getByRole('button', { name: 'New poll' }));
    const form = screen.getByTestId('pulse-poll-new');
    const save = within(form).getByRole('button', { name: 'Save as draft' });
    const note = () => within(form).queryByTestId('pulse-poll-missing');
    expect(save.disabled).toBe(true);
    expect(note().textContent).toBe('Choose an event to save.');
    expect(save.getAttribute('aria-describedby')).toBe(note().id);
    await waitFor(() => expect(within(form).getAllByRole('option', { name: 'The Gala' })).toHaveLength(1));
    fireEvent.change(within(form).getByLabelText('Event'), { target: { value: 'ev-1' } });
    expect(note().textContent).toBe('Options 1 and 2 need a label to save.');
    fireEvent.change(within(form).getByLabelText('Option 1'), { target: { value: 'A' } });
    expect(note().textContent).toBe('Option 2 needs a label to save.');
    fireEvent.change(within(form).getByLabelText('Option 2'), { target: { value: 'B' } });
    expect(note()).toBeNull();
    expect(save.disabled).toBe(false);
    expect(save.getAttribute('aria-describedby')).toBeNull();
  });

  test('a draft edits its question, options and closing time through PUT; its event is shown and not offered for change', async () => {
    serve({ polls: [DRAFT] });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    render(<PulsePolls showId="show-1" />);
    const card = await draftCard();
    await within(card).findByText('About The Gala.');
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    const form = screen.getByTestId('pulse-poll-edit');
    expect(within(form).getByTestId('pulse-poll-edit-event').textContent).toBe('About The Gala. A poll keeps the event it was made for.');
    expect(within(form).queryByLabelText('Event')).toBeNull();
    expect(within(form).getByLabelText('Question').value).toBe('Hat or no hat?');
    expect(within(form).getByLabelText('Option 1').value).toBe('Hat');
    expect([...form.querySelectorAll('.pulse-poll-pieces li')].map((li) => li.firstChild.textContent)).toEqual(['Pink blazer']);

    const save = within(form).getByRole('button', { name: 'Save changes' });
    fireEvent.change(within(form).getByLabelText('Question'), { target: { value: ' ' } });
    expect(save.disabled).toBe(true);
    expect(within(form).getByTestId('pulse-poll-missing').textContent).toBe('The question is needed to save.');
    fireEvent.change(within(form).getByLabelText('Question'), { target: { value: 'Hat, yes or no?' } });
    fireEvent.change(within(form).getByLabelText('Option 2'), { target: { value: 'Bare' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add an option' }));
    expect(within(form).getByTestId('pulse-poll-missing').textContent).toBe('Option 3 needs a label to save.');
    fireEvent.change(within(form).getByLabelText('Option 3'), { target: { value: 'Scarf' } });
    fireEvent.change(within(form).getByLabelText('Closes (optional)'), { target: { value: '2027-01-05T09:07' } });
    fireEvent.click(save);

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, sent] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/pulse-polls/p-d');
    expect(sent).toEqual({
      question: 'Hat, yes or no?', closes_at: new Date(2027, 0, 5, 9, 7).toISOString(),
      options: [{ label: 'Hat', wardrobe_ids: [W1] }, { label: 'Bare', wardrobe_ids: [] }, { label: 'Scarf', wardrobe_ids: [] }],
    });
    expect(Object.keys(sent)).not.toContain('world_event_id');
    await waitFor(() => expect(screen.queryByTestId('pulse-poll-edit')).toBeNull());
    expect(api.get.mock.calls.filter(([u]) => u.startsWith('/api/v1/pulse-polls')).length).toBe(2);
  });

  test('an edit the server refuses says so and keeps the form; Cancel leaves the draft as it was', async () => {
    serve({ polls: [DRAFT] });
    vi.mocked(api.put).mockRejectedValue({ response: { status: 400, data: { error: 'closes_at must be in the future.' } } });
    render(<PulsePolls showId="show-1" />);
    fireEvent.click(within(await draftCard()).getByRole('button', { name: 'Edit' }));
    const form = screen.getByTestId('pulse-poll-edit');
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect((await within(form).findByRole('alert')).textContent).toBe('closes_at must be in the future.');
    expect(vi.mocked(api.put).mock.calls[0][1].closes_at).toBeNull();
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('pulse-poll-edit')).toBeNull();
    expect(within(await draftCard()).getByText('Hat or no hat?')).toBeTruthy();
  });

  test('Remove draft asks first; Keep it does nothing; Remove calls DELETE and reloads; a refusal shows', async () => {
    serve({ polls: [DRAFT] });
    vi.mocked(api.delete).mockResolvedValueOnce({ data: { success: true } })
      .mockRejectedValueOnce({ response: { status: 409, data: { error: 'Only a draft poll can be removed.' } } });
    render(<PulsePolls showId="show-1" />);
    let card = await draftCard();
    fireEvent.click(within(card).getByRole('button', { name: 'Remove draft' }));
    expect(within(card).getByTestId('pulse-poll-remove-confirm').textContent).toMatch(/^Remove this draft\? It has taken no votes\./);
    expect(within(card).queryByRole('button', { name: 'Open' })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Keep it' }));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(within(card).getByRole('button', { name: 'Remove draft' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/pulse-polls/p-d'));
    await waitFor(() => expect(api.get.mock.calls.filter(([u]) => u.startsWith('/api/v1/pulse-polls')).length).toBe(2));

    card = await draftCard();
    fireEvent.click(within(card).getByRole('button', { name: 'Remove draft' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Remove' }));
    expect((await within(card).findByRole('alert')).textContent).toBe('Only a draft poll can be removed.');
    expect(within(card).getByRole('button', { name: 'Remove draft' })).toBeTruthy();
  });

  test('only a draft offers Edit and Remove; open and closed polls, their votes and results are left alone', async () => {
    render(<PulsePolls showId="show-1" />);
    const [open, closed, draft] = await screen.findAllByTestId('pulse-poll-card');
    for (const card of [open, closed]) {
      expect(within(card).queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(within(card).queryByRole('button', { name: 'Remove draft' })).toBeNull();
    }
    expect(within(draft).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(draft).getByRole('button', { name: 'Remove draft' })).toBeTruthy();
  });

  test('with voting off, Open is off and says why; Edit and Remove still work; nothing is posted', async () => {
    serve({ polls: [DRAFT], ready: false });
    render(<PulsePolls showId="show-1" />);
    const card = await draftCard();
    const open = within(card).getByRole('button', { name: 'Open' });
    expect(open.disabled).toBe(true);
    const note = within(card).getByTestId('pulse-poll-open-off');
    expect(note.textContent).toBe('It can open once voting is set up on the server.');
    expect(open.getAttribute('aria-describedby')).toBe(note.id);
    fireEvent.click(open);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByTestId('pulse-poll-not-ready').textContent).toBe('Voting is off on the server until POLL_HASH_SALT is set. Polls can be made and edited as drafts; they open once it is set.');
    expect(within(card).getByRole('button', { name: 'Edit' }).disabled).toBe(false);
    expect(within(card).getByRole('button', { name: 'Remove draft' }).disabled).toBe(false);
  });

  test('with voting on, a draft has no such note; a server refusal to open still shows', async () => {
    serve({ polls: [DRAFT] });
    vi.mocked(api.post).mockRejectedValue({ response: { status: 503, data: { error: 'Voting is not set up on the server yet, so a poll cannot open.' } } });
    render(<PulsePolls showId="show-1" />);
    const card = await draftCard();
    expect(within(card).queryByTestId('pulse-poll-open-off')).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Open' }));
    expect((await within(card).findByRole('alert')).textContent).toBe('Voting is not set up on the server yet, so a poll cannot open.');
  });

  test('an open poll links to The Pulse, where the audience sees it; drafts and closed polls do not', async () => {
    render(<MemoryRouter><PulsePolls showId="show-1" /></MemoryRouter>);
    const [open, closed, draft] = await screen.findAllByTestId('pulse-poll-card');
    const link = within(open).getByRole('link', { name: 'View in The Pulse' });
    expect(PULSE_PATH).toBe('/pulse');
    expect(link.getAttribute('href')).toBe('/pulse');
    expect(within(closed).queryByTestId('pulse-poll-view')).toBeNull();
    expect(within(draft).queryByTestId('pulse-poll-view')).toBeNull();
  });

  test('with no router around it the link is still a link to The Pulse', async () => {
    render(<PulsePolls showId="show-1" />);
    const [open] = await screen.findAllByTestId('pulse-poll-card');
    expect(within(open).getByRole('link', { name: 'View in The Pulse' }).getAttribute('href')).toBe('/pulse');
  });
});
