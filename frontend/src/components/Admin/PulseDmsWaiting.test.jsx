/**
 * Admin › The Pulse › Review › DMs (Task 2985): each drafted message shows
 * its gate and Approve, Edit (approve with new words) and Reject; "Draft the
 * next message" and "Start a conversation" queue through /api/v1/pulse-dms.
 * Review's count includes the DM drafts.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import { DmThread, StartConversation, draftsIn } from './PulseDmsWaiting';
import PulseReview, { loadReviewCount } from './PulseReview';
import { PulseRevealProvider } from './PulseRevealContext';

const LALA = { id: 1, handle: 'lala', display_name: 'Lala' };
const MARCUS = { id: 7, handle: 'marcus.k', display_name: 'Marcus' };
const GATE = { pass: true, voice: 0.9, review: ['dm', 'lala'], flags: [] };
const thread = (id, statuses) => ({
  id, topic: 'the afterparty', opened_story_order: 17, profiles: [LALA, MARCUS],
  messages: statuses.map((status, i) => ({
    id: `${id}-m${i}`, sender_profile_id: i % 2 ? 7 : 1, text: `message ${i}`, story_order: 17, status, gate: status === 'draft' ? GATE : null,
  })),
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, engine_on: false } });
});

test('draftsIn counts the draft messages', () => {
  expect(draftsIn([thread('a', ['live', 'draft']), thread('b', ['draft', 'draft'])])).toBe(3);
  expect(draftsIn(null)).toBe(0);
});

describe('a conversation', () => {
  test('its topic and messages in order; a draft shows its gate and the three decisions', async () => {
    const onChange = vi.fn();
    render(<ul><DmThread thread={thread('a', ['live', 'draft'])} onChange={onChange} /></ul>);
    expect(screen.getByText('@lala ↔ @marcus.k')).toBeTruthy();
    expect(screen.getByText('About: the afterparty')).toBeTruthy();
    const messages = screen.getAllByTestId('prv-dm-message');
    expect(messages.map((m) => m.textContent.startsWith('@lala') ? 'lala' : 'marcus')).toEqual(['lala', 'marcus']);
    expect(within(messages[1]).getByText('Draft')).toBeTruthy();
    expect(within(messages[1]).getByTestId('prv-gate').textContent).toContain("waiting: DM");
    expect(within(messages[0]).queryByRole('button', { name: 'Approve' })).toBeNull();
    fireEvent.click(within(messages[1]).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-dms/messages/a-m1', { action: 'approve' });
  });

  test('Edit approves with the new words; Reject; an error is shown', async () => {
    const onChange = vi.fn();
    render(<ul><DmThread thread={thread('a', ['draft'])} onChange={onChange} /></ul>);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByLabelText('The message');
    expect(box.value).toBe('message 0');
    fireEvent.change(box, { target: { value: '  u up??  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and approve' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-dms/messages/a-m0', { action: 'edit', text: 'u up??' }));
    vi.mocked(api.put).mockRejectedValueOnce({ response: { status: 409, data: { error: 'This message was already decided.' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This message was already decided.');
    expect(api.put).toHaveBeenLastCalledWith('/api/v1/pulse-dms/messages/a-m0', { action: 'reject' });
  });

  test('Draft the next message queues it and says the engine is off', async () => {
    render(<ul><DmThread thread={thread('a', ['live'])} /></ul>);
    fireEvent.click(screen.getByRole('button', { name: 'Draft the next message' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/Queued\. The posting engine is off/);
    expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-dms/a/next', {});
  });
});

describe('Start a conversation', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/pulse-voices?')) {
        return { data: { characters: [
          { registry_character_id: 'c-lala', display_name: 'Lala', handle: 'lala', social_profile_id: 1, voice: { id: 'v0' } },
          { registry_character_id: 'c1', display_name: 'Marcus', handle: 'marcus.k', social_profile_id: 7, voice: { id: 'v1' } },
          { registry_character_id: 'c2', display_name: 'Nia', handle: 'nia', social_profile_id: 9, voice: null },
        ] } };
      }
      if (url.startsWith('/api/v1/social-profiles/lala?')) return { data: { data: { profile: LALA } } };
      return { data: {} };
    });
  });

  test('characters with a voice (not Lala), who writes first, the moment and what it is about; queues the first message', async () => {
    const onStarted = vi.fn();
    render(<StartConversation showId="show-1" onStarted={onStarted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start a conversation' }));
    const form = await screen.findByTestId('prv-dm-start');
    const who = await within(form).findByLabelText('With');
    expect([...who.options].map((o) => o.textContent)).toEqual(['Choose a character', 'Marcus (@marcus.k)']);
    const queue = within(form).getByRole('button', { name: 'Queue the first message' });
    expect(queue.disabled).toBe(true);
    fireEvent.change(who, { target: { value: '7' } });
    fireEvent.change(within(form).getByLabelText('Who writes first'), { target: { value: 'other' } });
    fireEvent.change(within(form).getByLabelText(/Story moment/), { target: { value: '1x' } });
    expect(queue.disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText(/Story moment/), { target: { value: '17' } });
    fireEvent.change(within(form).getByLabelText('What it is about'), { target: { value: 'the afterparty' } });
    fireEvent.click(queue);
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-dms', {
      show_id: 'show-1', profile_a_id: 1, profile_b_id: 7, sender_profile_id: 7, story_order: 17, topic: 'the afterparty',
    });
  });
});

describe('in Review', () => {
  let threads;
  beforeEach(() => {
    threads = [thread('a', ['live', 'draft']), thread('b', ['live'])];
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/pulse-dms?')) return { data: { success: true, threads } };
      if (url.includes('/comments/pending')) return { data: { data: [] } };
      if (url.includes('/feed-posts')) return { data: { data: [], total: 0 } };
      return { data: {} };
    });
    vi.mocked(api.put).mockImplementation(async () => {
      threads = [thread('a', ['live', 'live']), thread('b', ['live'])];
      return { data: { success: true } };
    });
  });

  test('"DMs waiting" counts the drafts; quiet conversations sit under Conversations; approving takes the count down', async () => {
    const onCount = vi.fn();
    render(<MemoryRouter><PulseRevealProvider showId="show-1"><PulseReview showId="show-1" onCount={onCount} /></PulseRevealProvider></MemoryRouter>);
    const waiting = await screen.findByTestId('prv-dms');
    await waitFor(() => expect(within(waiting).getAllByTestId('prv-dm-thread')).toHaveLength(1));
    expect(within(waiting).getByRole('heading').textContent).toBe('DMs waiting (1)');
    expect(within(screen.getByTestId('prv-conversations')).getAllByTestId('prv-dm-thread')).toHaveLength(1);
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1));
    fireEvent.click(within(waiting).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(0));
    expect(within(screen.getByTestId('prv-conversations')).getAllByTestId('prv-dm-thread')).toHaveLength(2);
  });

  test('loadReviewCount adds the DM drafts', async () => {
    expect(await loadReviewCount('show-1')).toBe(1);
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-dms?show_id=show-1');
  });
});
