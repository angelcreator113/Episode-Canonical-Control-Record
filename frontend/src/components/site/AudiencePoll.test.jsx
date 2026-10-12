/**
 * The audience poll on the public landing page (Task 3006): nothing without
 * a poll; an open poll's options as buttons; a vote says thanks and is
 * remembered; already voted, not ready and failed say so; a closed poll
 * shows its result.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AudiencePoll, { PUBLIC_POLLS_URL } from './AudiencePoll';

const OPEN = { id: 'p1', question: 'Which look for The Gala?', status: 'open', closes_at: null,
  options: [{ id: 'o1', label: 'The pink set' }, { id: 'o2', label: 'The black dress' }] };
const CLOSED = { id: 'p0', question: 'Heels or flats?', status: 'closed', total: 4,
  options: [{ id: 'o3', label: 'Heels', votes: 3 }, { id: 'o4', label: 'Flats', votes: 1 }] };

const reply = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
let fetchMock;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn((url, opts) => (opts?.method === 'POST' ? reply(201, { success: true }) : reply(200, { polls: [OPEN, CLOSED] })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('the audience poll', () => {
  test('nothing without a poll, or when the read fails', async () => {
    fetchMock.mockImplementationOnce(() => reply(200, { polls: [] }));
    const { container, unmount } = render(<AudiencePoll />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(PUBLIC_POLLS_URL, expect.anything()));
    expect(container.innerHTML).toBe('');
    unmount();
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const second = render(<AudiencePoll />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(second.container.innerHTML).toBe('');
  });

  test('an open poll: the options as buttons; a vote posts, says thanks and is remembered', async () => {
    render(<AudiencePoll />);
    expect(await screen.findByRole('heading', { name: 'Which look for The Gala?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'The black dress' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`${PUBLIC_POLLS_URL}/p1/vote`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ option_id: 'o2' }),
    })));
    expect((await screen.findByRole('status')).textContent).toBe('Thanks for voting. Results when it closes.');
    expect(screen.queryByRole('button', { name: 'The pink set' })).toBeNull();
    expect(window.localStorage.getItem('pulse_voted:p1')).toBe('1');
  });

  test('a browser that voted before sees no buttons', async () => {
    window.localStorage.setItem('pulse_voted:p1', '1');
    render(<AudiencePoll />);
    expect((await screen.findByRole('status')).textContent).toBe("You've voted already. Results when it closes.");
    expect(screen.queryByRole('button', { name: 'The pink set' })).toBeNull();
  });

  test('already voted (409), not ready (503) and a failure say so; a failure lets them try again', async () => {
    fetchMock.mockImplementation((url, opts) => (opts?.method === 'POST' ? reply(503, { error: 'Voting is not set up yet.' }) : reply(200, { polls: [OPEN] })));
    render(<AudiencePoll />);
    fireEvent.click(await screen.findByRole('button', { name: 'The pink set' }));
    expect((await screen.findByRole('status')).textContent).toBe('Voting opens soon. Try again later.');
    fetchMock.mockImplementation((url, opts) => (opts?.method === 'POST' ? reply(500, {}) : reply(200, { polls: [OPEN] })));
    fireEvent.click(screen.getByRole('button', { name: 'The pink set' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Your vote could not be sent. Try again.'));
    fetchMock.mockImplementation((url, opts) => (opts?.method === 'POST' ? reply(409, { error: "You've voted already." }) : reply(200, { polls: [OPEN] })));
    fireEvent.click(screen.getByRole('button', { name: 'The pink set' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe("You've voted already. Results when it closes."));
  });

  test('a closed poll shows its result', async () => {
    fetchMock.mockImplementation(() => reply(200, { polls: [CLOSED] }));
    render(<AudiencePoll />);
    const results = await screen.findByTestId('site-poll-results');
    expect([...results.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Heels75%', 'Flats25%']);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
