/**
 * Producer Mode → Episodes → Episode Ledger → an episode's Tasks & Details
 * shows no false "required" (T1, §8(bb); Task #2292). An episode generated
 * before T1 keeps its stored tasks, with required: true on generated ones;
 * only a task backed by a deliverable shows "required", and every task shows
 * its source.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const EPISODE = { id: 'ep-1', episode_number: 1, title: 'Gala Night', status: 'draft' };
const STORED_TASKS = [
  { slot: 'brand_post_1', label: 'Sponsored Post 1', platform: 'instagram', timing: 'during', required: true },
  { slot: 'grwm', label: 'Get Ready With Me', platform: 'tiktok', timing: 'before', required: true },
  { slot: 'go_live', label: 'Go Live', platform: 'tiktok', timing: 'during', required: false },
  { slot: 'deliverable_d-1', label: 'One reel in the coat', platform: 'instagram_reel', timing: 'during', required: true, deliverable_id: 'd-1', task_source: 'deliverable' },
];

function renderLedger() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/world?tab=episodes-ledger']}>
      <Routes>
        <Route path="/shows/:id/world" element={<WorldAdmin />} />
      </Routes>
    </MemoryRouter>
  );
}

const row = (label) => screen.getByText(label).parentElement;

describe('Episode Ledger tasks show no false "required" (T1)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: [EPISODE] } };
      if (url === '/api/v1/episodes/ep-1/todo/social') return { data: { success: true, social_tasks: STORED_TASKS } };
      if (url === '/api/v1/world/show-1/events') return { data: { events: [] } };
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('only the deliverable is required; each task names its source', async () => {
    renderLedger();
    fireEvent.click(await screen.findByText('Gala Night'));
    fireEvent.click(await screen.findByRole('button', { name: /View Tasks & Details/ }));

    const panel = within(await screen.findByTestId('episode-tasks-content'));
    await panel.findByText('One reel in the coat');

    expect(panel.getAllByText('required')).toHaveLength(1);
    expect(within(row('One reel in the coat')).getByText('required')).toBeTruthy();
    // T2 (Task #2294): a deliverable stamped without owed_to reads as a host requirement.
    expect(within(row('One reel in the coat')).getByTestId('task-source').textContent).toBe('Host requirement');

    for (const label of ['Sponsored Post 1', 'Get Ready With Me']) {
      expect(within(row(label)).queryByText('required')).toBeNull();
      expect(within(row(label)).getByTestId('task-source').textContent).toBe('Goal');
    }
    expect(within(row('Go Live')).getByTestId('task-source').textContent).toBe('Optional idea');
  });
});
