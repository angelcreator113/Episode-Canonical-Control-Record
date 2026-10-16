/**
 * Admin › The Pulse › Engine (Task 2968; requests, Task 3031): today's
 * requests against the two daily limits, saving the limits, the ambient
 * switch (off by default), the note when the worker is off on this server,
 * the last jobs, and queueing a completed episode's posts (Task 3049).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import PulseEngine, { todayText } from './PulseEngine';

const STATE = {
  success: true,
  settings: { automated_requests: 5, manual_requests: 15, ambient_enabled: false },
  requests_today: { automated: 2, manual: 7 },
  drafts_today: 4,
  worker_enabled: false,
  jobs: [
    { id: 'j1', kind: 'event', status: 'done', drafts: 1, finished_at: '2026-10-12T10:00:00Z' },
    { id: 'j2', kind: 'ambient', status: 'skipped', drafts: 0, error: "Today's 5 automated requests are used; they reset at midnight UTC.", finished_at: '2026-10-12T11:00:00Z' },
    { id: 'j3', kind: 'event', status: 'done', drafts: 1, error: 'bo: the batch answer had no readable draft.', finished_at: '2026-10-12T12:00:00Z' },
  ],
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: STATE });
});

describe('the Engine tab', () => {
  test('an episode not completed yet, with its event, can have its event posts drafted now (step 6b)', async () => {
    const coming = { id: 'ep-1', episode_number: 1, title: 'The Swap', event_id: 'ev-1', event_name: 'Linen swap' };
    vi.mocked(api.get).mockResolvedValue({ data: { ...STATE, episodes_with_draft_events: [coming] } });
    vi.mocked(api.post).mockResolvedValue({ data: { ...STATE, episodes_with_draft_events: [], queued: 1, posts: 2 } });
    render(<PulseEngine showId="show-1" />);
    const card = await screen.findByTestId('pulse-engine-draft-events');
    expect(within(card).getByText('Episode 1, The Swap · Linen swap')).toBeTruthy();
    fireEvent.click(within(card).getByText("Draft this event's posts now"));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-engine/episodes/ep-1/draft-event', { show_id: 'show-1' }));
    expect((await screen.findByTestId('pulse-engine-note')).textContent).toBe('Drafting 2 posts about Linen swap for Episode 1, The Swap. They wait in Review.');
    expect(screen.queryByTestId('pulse-engine-draft-events')).toBeNull();
  });

  test('a completed episode without posts can be queued from Engine, and then leaves the list (Task 3049)', async () => {
    const waiting = { id: 'ep-9', episode_number: 9, title: 'The After Party' };
    vi.mocked(api.get).mockResolvedValue({ data: { ...STATE, episodes_without_posts: [waiting] } });
    vi.mocked(api.post).mockResolvedValue({ data: { ...STATE, episodes_without_posts: [], queued: 1, posts: 2 } });
    render(<PulseEngine showId="show-1" />);
    const card = await screen.findByTestId('pulse-engine-episodes');
    expect(card.textContent).toContain('Episode 9, The After Party');
    fireEvent.click(within(card).getByText('Queue its posts'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-engine/episodes/ep-9/queue', { show_id: 'show-1' }));
    expect((await screen.findByTestId('pulse-engine-note')).textContent).toBe('Queued 2 posts for Episode 9, The After Party.');
    expect(screen.queryByTestId('pulse-engine-episodes')).toBeNull();
  });

  test('no episodes card when every completed episode has its posts; a refusal shows its reason', async () => {
    render(<PulseEngine showId="show-1" />);
    await screen.findByTestId('pulse-engine-today');
    expect(screen.queryByTestId('pulse-engine-episodes')).toBeNull();
    vi.mocked(api.get).mockResolvedValue({ data: { ...STATE, episodes_without_posts: [{ id: 'ep-3', episode_number: 3, title: null }] } });
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { error: 'That episode is not completed, or its posts were queued already.' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<PulseEngine showId="show-1" />);
    fireEvent.click(within(await screen.findByTestId('pulse-engine-episodes')).getByText('Queue its posts'));
    expect((await screen.findByRole('alert')).textContent).toBe('That episode is not completed, or its posts were queued already.');
  });

  test('todayText: each lane against its limit', () => {
    expect(todayText(STATE)).toBe('Today: 2 of 5 automated, 7 of 15 manual.');
    expect(todayText({ settings: STATE.settings })).toBe('Today: 0 of 5 automated, 0 of 15 manual.');
  });

  test("today's requests against the limits, the worker-off note, ambient off, and the last jobs", async () => {
    render(<PulseEngine showId="show-1" />);
    expect((await screen.findByTestId('pulse-engine-today')).textContent).toBe('Today: 2 of 5 automated, 7 of 15 manual.');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-engine?show_id=show-1');
    expect(screen.getByTestId('pulse-engine-off').textContent).toMatch(/isn't running on this server/);
    const ambient = screen.getByRole('switch');
    expect(ambient.checked).toBe(false);
    expect(screen.getByText('Ambient posts off')).toBeTruthy();
    const jobs = within(screen.getByTestId('pulse-engine-jobs')).getAllByRole('listitem').map((li) => li.textContent);
    expect(jobs[0]).toMatch(/^DoneEvent post · 1 draft/);
    expect(jobs[1]).toMatch(/^SkippedAmbient post.*Today's 5 automated requests are used; they reset at midnight UTC\.$/);
    // A batch that drafted some of its items says which it could not (Task 3032).
    expect(jobs[2]).toMatch(/^DoneEvent post · 1 draft.*bo: the batch answer had no readable draft\.$/);
  });

  test('no worker note once the server runs the engine', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...STATE, worker_enabled: true, jobs: [] } });
    render(<PulseEngine showId="show-1" />);
    await screen.findByTestId('pulse-engine-today');
    expect(screen.queryByTestId('pulse-engine-off')).toBeNull();
    expect(screen.getByText('No jobs yet.')).toBeTruthy();
  });

  test('saving the limits: only changed whole numbers from 0 to 100', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { ...STATE, settings: { ...STATE.settings, automated_requests: 3, manual_requests: 20 } } });
    render(<PulseEngine showId="show-1" />);
    const automated = await screen.findByLabelText('Automated requests a day');
    const manual = screen.getByLabelText('Manual requests a day');
    expect(automated.value).toBe('5');
    expect(manual.value).toBe('15');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.disabled).toBe(true);
    fireEvent.change(automated, { target: { value: '101' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(automated, { target: { value: '3' } });
    fireEvent.change(manual, { target: { value: '20' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-engine', { show_id: 'show-1', automated_requests: 3, manual_requests: 20 }));
    expect((await screen.findByTestId('pulse-engine-today')).textContent).toBe('Today: 2 of 3 automated, 7 of 20 manual.');
  });

  test('the ambient switch turns ambient posts on', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { ...STATE, settings: { ...STATE.settings, ambient_enabled: true } } });
    render(<PulseEngine showId="show-1" />);
    fireEvent.click(await screen.findByRole('switch'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-engine', { show_id: 'show-1', ambient_enabled: true }));
    expect(await screen.findByText('Ambient posts on')).toBeTruthy();
    expect(screen.getByRole('switch').checked).toBe(true);
  });

  test('a refused save and a failed read are shown', async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { status: 403, data: { error: 'Admins only.' } } });
    const { unmount } = render(<PulseEngine showId="show-1" />);
    fireEvent.click(await screen.findByRole('switch'));
    expect((await screen.findByRole('alert')).textContent).toBe('Admins only.');
    unmount();
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } });
    render(<PulseEngine showId="show-1" />);
    expect((await screen.findByRole('alert')).textContent).toBe('The engine could not be loaded.');
  });
});
