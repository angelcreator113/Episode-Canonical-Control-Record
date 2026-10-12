/**
 * Admin › The Pulse › Engine (Task 2968): today's drafts against the cap,
 * saving the cap, the ambient switch (off by default), the note when the
 * worker is off on this server, and the last jobs.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import PulseEngine from './PulseEngine';

const STATE = {
  success: true,
  settings: { daily_draft_cap: 30, ambient_enabled: false },
  drafts_today: 4,
  cap_left: 26,
  worker_enabled: false,
  jobs: [
    { id: 'j1', kind: 'event', status: 'done', drafts: 1, finished_at: '2026-10-12T10:00:00Z' },
    { id: 'j2', kind: 'ambient', status: 'skipped', drafts: 0, error: 'The daily draft cap (30) was reached for today.', finished_at: '2026-10-12T11:00:00Z' },
  ],
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: STATE });
});

describe('the Engine tab', () => {
  test("today's drafts against the cap, the worker-off note, ambient off, and the last jobs", async () => {
    render(<PulseEngine showId="show-1" />);
    expect((await screen.findByTestId('pulse-engine-today')).textContent).toBe('4 of 30 drafts made · 26 left');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-engine?show_id=show-1');
    expect(screen.getByTestId('pulse-engine-off').textContent).toMatch(/isn't running on this server/);
    const ambient = screen.getByRole('switch');
    expect(ambient.checked).toBe(false);
    expect(screen.getByText('Ambient posts off')).toBeTruthy();
    const jobs = within(screen.getByTestId('pulse-engine-jobs')).getAllByRole('listitem').map((li) => li.textContent);
    expect(jobs[0]).toMatch(/^DoneEvent post · 1 draft/);
    expect(jobs[1]).toMatch(/^SkippedAmbient post.*The daily draft cap \(30\) was reached for today\.$/);
  });

  test('no worker note once the server runs the engine', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...STATE, worker_enabled: true, jobs: [] } });
    render(<PulseEngine showId="show-1" />);
    await screen.findByTestId('pulse-engine-today');
    expect(screen.queryByTestId('pulse-engine-off')).toBeNull();
    expect(screen.getByText('No jobs yet.')).toBeTruthy();
  });

  test('saving the cap: only a changed whole number from 0 to 500', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { ...STATE, settings: { ...STATE.settings, daily_draft_cap: 12 }, cap_left: 8 } });
    render(<PulseEngine showId="show-1" />);
    const input = await screen.findByLabelText('Daily draft cap');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '501' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '12' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-engine', { show_id: 'show-1', daily_draft_cap: 12 }));
    expect((await screen.findByTestId('pulse-engine-today')).textContent).toBe('4 of 12 drafts made · 8 left');
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
