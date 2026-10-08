/**
 * Lala's Phone audit (Evoni, 2026-10-07): in the mission editor a navigate
 * reward had no screens to pick, an unfinished objective was dropped on
 * save, the order reset to 0, and a failed delete said nothing.
 */
import React from 'react';
import { vi, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
import api from '../../services/api';
import MissionEditor from './MissionEditor';

const MISSION = {
  id: 'm1', name: 'Find the invite', description: null, is_active: true, episode_id: 'ep-1', display_order: 4,
  start_condition: [{ key: 'met_lala', op: 'eq', value: true }],
  objectives: [{ id: 'o1', label: 'Opened mail', condition: [{ key: 'visited:mail', op: 'eq', value: true }] }],
  reward_actions: [],
};
const SCREENS = [
  { id: 'home', name: 'Home', category: 'phone', generated: true },
  { id: 'mail', name: 'Mail', category: 'phone', generated: true },
  { id: 'icon-chat', name: 'Chat icon', category: 'phone_icon', generated: true },
  { id: 'empty', name: 'Empty', category: 'phone', generated: false },
];

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.put).mockReset();
  vi.mocked(api.delete).mockReset();
  api.get.mockImplementation((url) => Promise.resolve(url.includes('/missions')
    ? { data: { missions: [MISSION] } }
    : { data: { data: SCREENS } }));
  api.put.mockResolvedValue({ data: { success: true } });
});

const openEdit = async () => {
  render(<MissionEditor open showId="show-1" episodeId="ep-1" onClose={() => {}} />);
  await screen.findByText('Find the invite');
  const edit = screen.getAllByRole('button').find((b) => /lucide-(edit|pen)/.test(b.querySelector('svg')?.getAttribute('class') || ''));
  fireEvent.click(edit);
  await screen.findByText('Save mission');
};

test("a navigate reward lists the show's screens (not icons, not empty ones)", async () => {
  await openEdit();
  fireEvent.click(screen.getByText('reward'));
  fireEvent.change(screen.getAllByRole('combobox').at(-1), { target: { value: 'navigate' } });
  await waitFor(() => expect(screen.getByRole('option', { name: 'Mail' })).toBeTruthy());
  expect(screen.getByRole('option', { name: 'Home' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Chat icon' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Empty' })).toBeNull();
});

test('saving keeps the order and the start condition', async () => {
  await openEdit();
  fireEvent.click(screen.getByText('Save mission'));
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  expect(api.put.mock.calls[0][1]).toMatchObject({ display_order: 4, start_condition: MISSION.start_condition });
});

test('an unfinished objective or reward is said, not dropped', async () => {
  await openEdit();
  fireEvent.click(screen.getByText('objective'));
  fireEvent.click(screen.getByText('Save mission'));
  expect(await screen.findByText('Objective 2 needs a label and a condition with a key, or remove it.')).toBeTruthy();
  expect(api.put).not.toHaveBeenCalled();
});

test('a failed delete says so', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  api.delete.mockRejectedValue({ response: { data: { error: 'mission not found' } } });
  render(<MissionEditor open showId="show-1" episodeId="ep-1" onClose={() => {}} />);
  await screen.findByText('Find the invite');
  const del = screen.getAllByRole('button').find((b) => /lucide-trash/.test(b.querySelector('svg')?.getAttribute('class') || ''));
  fireEvent.click(del);
  expect(await screen.findByText('Not deleted: mission not found')).toBeTruthy();
});
