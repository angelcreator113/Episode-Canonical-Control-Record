/**
 * Producer Mode → Episodes: "Tasks & Details" opens, closes and reopens,
 * and two episodes' panels toggle independently (Task #2272).
 */

import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import EpisodeTasksPanel from './EpisodeTasksPanel';

const details = (label) => ({
  event: { venue_name: 'The Atrium' },
  automation: { host_display_name: 'Maison Rue', host_handle: '@maisonrue', guest_profiles: [{ display_name: 'Nia' }] },
  socialTasks: [{ slot: 'grwm', label, platform: 'tiktok', timing: 'before', required: true, completed: true, source: 'platform' }],
});

describe('EpisodeTasksPanel', () => {
  test('opens, closes and reopens; the arrow follows; it loads once', async () => {
    const load = vi.fn().mockResolvedValue(details('Get Ready With Me'));
    render(<EpisodeTasksPanel episodeId="ep-1" load={load} />);

    const button = screen.getByRole('button', { name: /View Tasks & Details/ });
    expect(screen.queryByTestId('episode-tasks-content')).toBeNull();

    fireEvent.click(button);
    expect(await screen.findByText('Get Ready With Me')).toBeTruthy();
    expect(button.textContent).toBe('📱 Tasks & Details ▲');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/The Atrium/)).toBeTruthy();

    fireEvent.click(button);
    expect(screen.queryByTestId('episode-tasks-content')).toBeNull();
    expect(button.textContent).toBe('📱 Tasks & Details ▼');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(button);
    expect(await screen.findByText('Get Ready With Me')).toBeTruthy();
    expect(button.textContent).toBe('📱 Tasks & Details ▲');
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('ep-1');
  });

  test('two episodes toggle independently', async () => {
    const load = vi.fn(async (id) => details(`Task for ${id}`));
    render(
      <>
        <div data-testid="ep-a"><EpisodeTasksPanel episodeId="ep-a" load={load} /></div>
        <div data-testid="ep-b"><EpisodeTasksPanel episodeId="ep-b" load={load} /></div>
      </>
    );
    const a = within(screen.getByTestId('ep-a'));
    const b = within(screen.getByTestId('ep-b'));

    fireEvent.click(a.getByRole('button'));
    expect(await a.findByText('Task for ep-a')).toBeTruthy();
    expect(b.queryByTestId('episode-tasks-content')).toBeNull();
    expect(b.getByRole('button').textContent).toBe('📱 View Tasks & Details');

    fireEvent.click(b.getByRole('button'));
    expect(await b.findByText('Task for ep-b')).toBeTruthy();

    fireEvent.click(a.getByRole('button'));
    expect(a.queryByTestId('episode-tasks-content')).toBeNull();
    expect(b.getByText('Task for ep-b')).toBeTruthy();
    expect(b.getByRole('button').textContent).toBe('📱 Tasks & Details ▲');
  });

  test('a failed load leaves the panel closed and can be retried', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(details('Retry task'));
    render(<EpisodeTasksPanel episodeId="ep-1" load={load} />);

    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/Couldn't load tasks/)).toBeTruthy();
    expect(screen.queryByTestId('episode-tasks-content')).toBeNull();

    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('Retry task')).toBeTruthy();
  });
});
