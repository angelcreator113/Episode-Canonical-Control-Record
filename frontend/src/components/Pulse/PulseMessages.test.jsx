/**
 * The Pulse › Messages (Task 2985): Lala's conversations at the page's story
 * moment, live messages only; a list, then one conversation with Back.
 */
import React from 'react';
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import PulseMessages, { otherOf } from './PulseMessages';

const SHOW = { id: 'show-1' };
const LALA = { profile: { id: 1, handle: 'lala', display_name: 'Lala' } };
const THREADS = [
  {
    id: 't1', opened_story_order: 17,
    profiles: [{ id: 1, handle: 'lala', display_name: 'Lala' }, { id: 7, handle: 'marcus.k', display_name: 'Marcus' }],
    messages: [
      { id: 'm1', sender_profile_id: 1, text: 'u up?', story_order: 17 },
      { id: 'm2', sender_profile_id: 7, text: 'always', story_order: 17 },
    ],
  },
  {
    id: 't2', opened_story_order: 18,
    profiles: [{ id: 1, handle: 'lala', display_name: 'Lala' }, { id: 9, handle: 'nia', display_name: null }],
    messages: [{ id: 'm3', sender_profile_id: 1, text: 'did you see the fit', story_order: 18 }],
  },
];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, at: 17, threads: THREADS } });
});

test('the other one in a conversation, from Lala\'s side', () => {
  expect(otherOf(THREADS[0], 1).handle).toBe('marcus.k');
  expect(otherOf(THREADS[0], '1').handle).toBe('marcus.k');
});

test("reads Lala's live conversations at the page's moment, or the present", async () => {
  const { rerender } = render(<PulseMessages show={SHOW} lala={LALA} viewAt="17" />);
  await screen.findByTestId('pl-msg-inbox');
  expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-dms?show_id=show-1&at=17&profile_id=1');
  rerender(<PulseMessages show={SHOW} lala={LALA} viewAt={null} />);
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/v1/pulse-dms?show_id=show-1&at=present&profile_id=1'));
});

test('the inbox: each conversation with the other one and the last message; opening one shows it, Back returns', async () => {
  render(<PulseMessages show={SHOW} lala={LALA} viewAt="18" />);
  const rows = await screen.findAllByTestId('pl-msg-row');
  expect(rows).toHaveLength(2);
  expect(rows[1].textContent).toContain('@nia');
  expect(rows[1].textContent).toContain('You: did you see the fit');
  expect(rows[0].textContent).toContain('Marcus');
  expect(rows[0].textContent).toContain('always');
  expect(rows[0].textContent).not.toContain('You:');
  fireEvent.click(rows[0]);
  const thread = screen.getByTestId('pl-msg-thread');
  expect(within(thread).getByText('Marcus')).toBeTruthy();
  const bubbles = within(thread).getAllByTestId('pl-msg-bubble');
  expect(bubbles.map((b) => [b.textContent, b.className.includes('mine')])).toEqual([['u up?', true], ['always', false]]);
  fireEvent.click(within(thread).getByRole('button', { name: /Messages/ }));
  expect(screen.getByTestId('pl-msg-inbox')).toBeTruthy();
});

test('nothing yet, and an error, say so', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, threads: [] } });
  const { unmount } = render(<PulseMessages show={SHOW} lala={LALA} viewAt="17" />);
  expect((await screen.findByTestId('pl-msg-empty')).textContent).toBe('No messages yet.');
  unmount();
  vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 500 } });
  render(<PulseMessages show={SHOW} lala={LALA} viewAt="17" />);
  expect((await screen.findByRole('alert')).textContent).toBe('Messages could not be loaded.');
});

test('with no Lala profile there is nothing to read', () => {
  render(<PulseMessages show={SHOW} lala={false} viewAt="17" />);
  expect(screen.getByTestId('pl-msg-empty')).toBeTruthy();
  expect(api.get).not.toHaveBeenCalled();
});
