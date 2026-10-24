/**
 * A goal covered by its person (Evoni, 2026-10-23: "Get to know
 * Truthville" never ticked when the script named her by her real name):
 * the must-cover list says the beat and who, and Tick it completes the
 * goal's task with where it was ticked from. Nothing ticks on its own.
 */
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = [
  '## BEAT: 11 · Event Outcome', 'Marcus Hale: So you are the Lala everyone wants to get to know.', 'Lala: "And you are the one I came to meet."',
].join('\n');
const GOAL = { slot: 'relationship_guest', label: 'Get to know Truthville', profile_id: 9 };
const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Velour Night', canon_consequences: { automation: {
  relationship_goals: [GOAL, { slot: 'relationship_brand', label: 'Co-style a moment with Velour' }],
  guest_profiles: [{ profile_id: 9, display_name: 'Truthville', handle: 'truthville' }],
} } };
const TASK = { slot: 'relationship_guest', label: 'Get to know Truthville', task_source: 'goal', completed: false };

let social;
const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const openCover = async () => fireEvent.click(await screen.findByTestId('script-side-tab-cover'));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  social = [TASK, { slot: 'post_reel', label: 'Post the reel', task_source: 'deliverable', completed: false }];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { event_id: 'ev-1' } } };
    if (url === '/api/v1/world/show-1/events/ev-1') return { data: { event: EVENT } };
    if (url === '/api/v1/social-profiles/9') return { data: { profile: { id: 9, creator_name: 'Marcus Hale', display_name: 'Truthville', handle: 'truthville' } } };
    if (url === '/api/v1/episodes/ep-1/todo/social') return { data: { success: true, social_tasks: social } };
    return { data: { data: [] } };
  });
  vi.mocked(api.post).mockImplementation(async (url, body) => ({ data: { success: true, social_tasks: social.map((t) => (t.slot === 'relationship_guest' ? { ...t, completed: true, completed_source: body.source, completed_beat: body.beat } : t)) } }));
});

test('covered in beat 11 by her real name, with Tick it; the brand goal is not', async () => {
  renderTab();
  await openCover();
  await waitFor(() => expect(screen.getByTestId('script-cover-goal-0').dataset.covered).toBe('true'));
  expect(screen.getByTestId('script-cover-goal-0-where').textContent).toBe('Covered in beat 11 · Truthville, as Marcus Hale');
  expect(screen.getByTestId('script-cover-goal-1').dataset.covered).toBe('false');
  expect(await screen.findByTestId('script-cover-goal-0-tick')).toBeTruthy();
  // Nothing ticks on its own.
  expect(api.post).not.toHaveBeenCalled();
});

test('Tick it completes the goal task from the script, then reads Ticked', async () => {
  renderTab();
  await openCover();
  fireEvent.click(await screen.findByTestId('script-cover-goal-0-tick'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo/complete/relationship_guest', { completed: true, source: 'script', beat: 11 }));
  expect((await screen.findByTestId('script-cover-goal-0-ticked')).textContent).toBe('Ticked');
  expect(screen.queryByTestId('script-cover-goal-0-tick')).toBeNull();
});

test('a task already done reads Ticked; no to-do list, no button', async () => {
  social = [{ ...TASK, completed: true }];
  const first = renderTab();
  await openCover();
  expect((await screen.findByTestId('script-cover-goal-0-ticked')).textContent).toBe('Ticked');
  first.unmount();
  social = [];
  renderTab();
  await openCover();
  await waitFor(() => expect(screen.getByTestId('script-cover-goal-0-where').textContent).toContain('as Marcus Hale'));
  expect(screen.queryByTestId('script-cover-goal-0-tick')).toBeNull();
  expect(screen.queryByTestId('script-cover-goal-0-ticked')).toBeNull();
});

test('a failed tick says so and keeps the button', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(api.post).mockRejectedValue(new Error('down'));
  renderTab();
  await openCover();
  fireEvent.click(await screen.findByTestId('script-cover-goal-0-tick'));
  expect((await screen.findByRole('alert')).textContent).toContain("Couldn't tick it");
  expect(screen.getByTestId('script-cover-goal-0-tick')).toBeTruthy();
});

// Episode 1 feeds Episode 2 (Evoni, 2026-10-23): a follow-up carried from an
// earlier episode is on the list, read even without event goals, and Tick it
// completes its task (which settles the follow-up on the server).
test('a carried follow-up is listed and ticked like a goal', async () => {
  const CARRIED = { slot: 'follow_up_f1', label: 'Get to know Truthville', task_source: 'goal', follow_up_id: 'f1', profile_id: 9, completed: false };
  social = [CARRIED];
  vi.mocked(api.post).mockImplementation(async () => ({ data: { success: true, social_tasks: [{ ...CARRIED, completed: true }] } }));
  renderTab();
  await openCover();
  await waitFor(() => expect(screen.getByTestId('script-cover-carried-f1').dataset.covered).toBe('true'));
  expect(screen.getByTestId('script-cover-carried-f1').textContent).toContain('Follow-up');
  fireEvent.click(await screen.findByTestId('script-cover-carried-f1-tick'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo/complete/follow_up_f1', { completed: true, source: 'script', beat: 11 }));
  expect((await screen.findByTestId('script-cover-carried-f1-ticked')).textContent).toBe('Ticked');
});
