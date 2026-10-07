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
  expect(await screen.findByText('Find the invite')).toBeTruthy();
  const edit = screen.getAllByRole('button').find((b) => /lucide-(edit|pen)/.test(b.querySelector('svg')?.getAttribute('class') || ''));
  fireEvent.click(edit);
  fireEvent.click(await screen.findByText('Save mission'));
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  expect(api.put.mock.calls[0][0]).toBe('/api/v1/ui-overlays/show-1/missions/m1');
  expect(api.put.mock.calls[0][1].episode_id).toBe('ep-7');
});

// Lala's Phone step 2 (Evoni, 2026-10-07): no show-wide missions.
test('a new mission belongs to the episode, with no show-wide choice', async () => {
  api.get.mockResolvedValue({ data: { missions: [] } });
  api.post.mockResolvedValue({ data: { success: true } });
  render(<MissionEditor open showId="show-1" episodeId="ep-9" onClose={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'New' }));
  expect(screen.queryByText(/scope to this episode/i)).toBeNull();
  fireEvent.change(screen.getByPlaceholderText(/Break up with the ex/), { target: { value: 'Find the key' } });
  fireEvent.click(screen.getByText('Save mission'));
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  expect(api.post.mock.calls[0][1].episode_id).toBe('ep-9');
});

test('an older show-wide mission says so, and saving it moves it to this episode', async () => {
  api.get.mockResolvedValue({ data: { missions: [
    { id: 'm2', name: 'Follow Lala', description: null, objectives: [], reward_actions: [], is_active: true, episode_id: null },
  ] } });
  api.put.mockResolvedValue({ data: { success: true } });
  render(<MissionEditor open showId="show-1" episodeId="ep-9" onClose={() => {}} />);
  expect(await screen.findByText(/all episodes \(older\)/)).toBeTruthy();
  const edit = screen.getAllByRole('button').find((b) => /lucide-(edit|pen)/.test(b.querySelector('svg')?.getAttribute('class') || ''));
  fireEvent.click(edit);
  fireEvent.click(await screen.findByText('Save mission'));
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  expect(api.put.mock.calls.at(-1)[1].episode_id).toBe('ep-9');
});
