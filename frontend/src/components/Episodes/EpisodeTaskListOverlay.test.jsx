/**
 * Task list approval + task-list overlay (Task #2395, ruling P14).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeTaskListOverlay from './EpisodeTaskListOverlay';

const ESTIMATE = { usd: 0.04, priced: true, unit: 'megapixel', units: 1, model: 'fal-ai/flux-pro/v1.1' };
const HASH = 'a'.repeat(64);

const state = (over = {}) => ({
  exists: true, task_count: 3, hash: HASH, approved: false, approved_at: null, overlay: null, offer: { offered: false },
  ...over,
});
const ok = (data) => Promise.resolve({ data: { success: true, data } });
const OVERLAY = {
  asset_id: 'o1', designed_hash: HASH, outdated: false, image_url: 'https://img/tl.png',
  overlay_type: 'TodoListOverlay', beat: { number: 9, name: 'Reminder/Deadline' },
};

describe('EpisodeTaskListOverlay', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  test('not approved: "Approve task list"; approving sends the list\'s hash and shows the design offer with its cost', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state()));
    vi.mocked(api.post).mockReturnValue(ok(state({
      approved: true, offer: { offered: true, kind: 'design', requires_approval: false, estimate: ESTIMATE },
    })));
    render(<EpisodeTaskListOverlay episodeId="ep-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Approve task list/ }));
    expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/task-list/approve', { hash: HASH });
    expect(await screen.findByRole('button', { name: 'Design task-list overlay — est. $0.04' })).toBeTruthy();
    expect(screen.getByTestId('etlo-approved')).toBeTruthy();
  });

  test('design posts to the episode and shows the overlay and its beat', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state({
      approved: true, offer: { offered: true, kind: 'design', requires_approval: false, estimate: ESTIMATE },
    })));
    vi.mocked(api.post).mockReturnValue(ok({ assetId: 'o1', state: state({ approved: true, overlay: OVERLAY }) }));
    render(<EpisodeTaskListOverlay episodeId="ep-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Design task-list overlay/ }));
    expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/task-list-overlay');
    const img = await screen.findByTestId('etlo-thumb');
    expect(img.getAttribute('src')).toBe('https://img/tl.png');
    expect(screen.getByText('Episode overlay · Beat 9: Reminder/Deadline')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Design task-list overlay/ })).toBeNull();
  });

  test('changed list: "overlay outdated" and "Approve task list & redesign" approves, then designs', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state({
      hash: 'b'.repeat(64),
      overlay: { ...OVERLAY, outdated: true },
      offer: { offered: true, kind: 'redesign', requires_approval: true, estimate: ESTIMATE },
    })));
    vi.mocked(api.post).mockImplementation((url) => (url.endsWith('/approve')
      ? ok(state({ approved: true }))
      : ok({ assetId: 'o2', state: state({ approved: true, overlay: { ...OVERLAY, asset_id: 'o2', image_url: 'https://img/tl2.png' } }) })));
    render(<EpisodeTaskListOverlay episodeId="ep-1" />);

    expect(await screen.findByTestId('etlo-outdated')).toBeTruthy();
    expect(screen.getByTestId('etlo-thumb').className).toContain('etlo-thumb-outdated');
    expect(screen.queryByRole('button', { name: /^Approve task list$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Approve task list & redesign (est. $0.04)' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[0]).toEqual(['/api/v1/episodes/ep-1/task-list/approve', { hash: 'b'.repeat(64) }]);
    expect(vi.mocked(api.post).mock.calls[1]).toEqual(['/api/v1/episodes/ep-1/task-list-overlay']);
    await waitFor(() => expect(screen.getByTestId('etlo-thumb').getAttribute('src')).toBe('https://img/tl2.png'));
    expect(screen.queryByTestId('etlo-outdated')).toBeNull();
  });

  test('a budget refusal shows its message', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state({
      approved: true, offer: { offered: true, kind: 'design', requires_approval: false, estimate: ESTIMATE },
    })));
    vi.mocked(api.post).mockRejectedValue({ response: { status: 429, data: { error: 'Daily image budget reached ($10.00).' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<EpisodeTaskListOverlay episodeId="ep-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Design task-list overlay/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Daily image budget reached ($10.00).');
  });

  test('an unpriced model reads "price not set"; an empty list shows nothing', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state({
      approved: true, offer: { offered: true, kind: 'design', requires_approval: false, estimate: { usd: null, priced: false } },
    })));
    const { unmount } = render(<EpisodeTaskListOverlay episodeId="ep-1" />);
    expect(await screen.findByRole('button', { name: 'Design task-list overlay — est. price not set' })).toBeTruthy();
    unmount();

    vi.mocked(api.get).mockReturnValue(ok(state({ task_count: 0, hash: null })));
    render(<EpisodeTaskListOverlay episodeId="ep-2" />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-2/task-list-overlay'));
    expect(screen.queryByTestId('episode-task-list-overlay')).toBeNull();
  });
});
