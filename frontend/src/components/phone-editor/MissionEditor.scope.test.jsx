/**
 * Lala's Phone step 1 (Evoni, 2026-10-07): an episode's mission edited from
 * the show's Phone (no episodeId there) keeps its episode; it used to be
 * saved show-wide.
 */
import React from 'react';
import { vi, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
import api from '../../services/api';
import MissionEditor from './MissionEditor';

test("editing an episode's mission from the show keeps its episode", async () => {
  api.get.mockResolvedValue({ data: { missions: [
    { id: 'm1', name: 'Find the invite', description: null, objectives: [], reward_actions: [], is_active: true, episode_id: 'ep-7' },
  ] } });
  api.put.mockResolvedValue({ data: { success: true } });
  render(<MissionEditor open showId="show-1" onClose={() => {}} />);
  expect(await screen.findByText(/episode-scoped/)).toBeTruthy();
  const edit = screen.getAllByRole('button').find((b) => /lucide-(edit|pen)/.test(b.querySelector('svg')?.getAttribute('class') || ''));
  fireEvent.click(edit);
  fireEvent.click(await screen.findByText('Save mission'));
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  expect(api.put.mock.calls[0][0]).toBe('/api/v1/ui-overlays/show-1/missions/m1');
  expect(api.put.mock.calls[0][1].episode_id).toBe('ep-7');
});
