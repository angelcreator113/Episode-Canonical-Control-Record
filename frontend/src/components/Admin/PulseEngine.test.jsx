/**
 * Admin › The Pulse › Engine (Task 2968; requests, Task 3031): today's
 * requests against the two daily limits, saving the limits, the ambient
 * switch (off by default), the note when the worker is off on this server,
 * and the last jobs.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

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
