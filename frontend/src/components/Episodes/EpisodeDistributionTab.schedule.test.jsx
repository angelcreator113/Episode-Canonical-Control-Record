/**
 * The show's release schedule on an episode's Distribution tab (Evoni,
 * 2026-10-25): YouTube, the one platform on the schedule, is offered the
 * episode's release day and time when it has none; it is filled only when
 * she says so and saved only by Save. TikTok and the rest are never offered
 * it and keep their own times.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('./StyleSheetDistributionCard', () => ({ default: () => null }));

import apiClient from '../../services/api';
import Tab from './EpisodeDistributionTab';

const VIEW = {
  schedule: { day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-11-01', paused: false, platforms: ['youtube'] },
  state: 'active',
  episodes: [{ episode_id: 'ep-1', episode_number: 1, date: '2026-11-01', time: '10:00', source: 'schedule', due: 'later' }],
  slots: {},
};
const EP = {
  id: 'ep-1', show_id: 'show-1', title: 'Gala Night',
  distribution_metadata: {
    youtube: { enabled: true, title: 'Gala Night', hashtags: [], status: 'draft', scheduled_time: null },
    tiktok: { enabled: true, caption: 'Hi', hashtags: [], status: 'draft', scheduled_time: null },
    instagram: { enabled: true, caption: 'Hi', hashtags: [], status: 'draft', scheduled_time: '2026-11-03T18:00' },
  },
};

async function renderTab(view = VIEW) {
  vi.mocked(apiClient.get).mockImplementation(async (url) => (url === '/api/v1/world/show-1/release-schedule'
    ? { data: { success: true, data: view } } : { data: { success: true, data: [] } }));
  render(<MemoryRouter><Tab episode={EP} onUpdate={() => {}} onOpenTab={() => {}} /></MemoryRouter>);
  await screen.findByTestId('dist-row-youtube');
}
const open = (p) => fireEvent.click(within(screen.getByTestId(`dist-row-${p}`)).getAllByRole('button')[0]);

describe('Distribution tab and the release schedule', () => {
  beforeEach(() => Object.values(apiClient).forEach((fn) => fn.mockReset()));

  test('YouTube is offered Sun, Nov 1 · 10:00 AM and takes it only on "Use it"', async () => {
    await renderTab();
    const hint = await screen.findByTestId('dist-when-suggest');
    expect(hint.textContent).toContain('This episode releases Sun, Nov 1 · 10:00 AM (from the weekly schedule).');
    expect(screen.getByLabelText('Scheduled Time').value).toBe('');
    expect(apiClient.put).not.toHaveBeenCalled();
    fireEvent.click(within(hint).getByRole('button', { name: 'Use it' }));
    expect(screen.getByLabelText('Scheduled Time').value).toBe('2026-11-01T10:00');
    expect(screen.queryByTestId('dist-when-suggest')).toBeNull();
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  test('TikTok and Instagram are not on the schedule: no offer, their own times untouched', async () => {
    await renderTab();
    await screen.findByTestId('dist-when-suggest');
    open('tiktok');
    expect(await screen.findByRole('heading', { name: 'TikTok' })).toBeTruthy();
    expect(screen.queryByTestId('dist-when-suggest')).toBeNull();
    expect(screen.getByLabelText('Scheduled Time').value).toBe('');
    open('instagram');
    expect(await screen.findByRole('heading', { name: /Instagram/ })).toBeTruthy();
    expect(screen.queryByTestId('dist-when-suggest')).toBeNull();
    expect(screen.getByLabelText('Scheduled Time').value).toBe('2026-11-03T18:00');
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  test('no offer while not releasing yet, or with no schedule', async () => {
    await renderTab({ ...VIEW, state: 'preview', episodes: [{ ...VIEW.episodes[0], source: 'preview', due: null }] });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('dist-when-suggest')).toBeNull();
  });
});
