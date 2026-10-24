/**
 * Must cover, Script tab audit 6 (2026-10-24): her manual marks (Evoni:
 * "smarter matching + manual override"), one tick at a time, Tick it from
 * the saved script only, Untick, and Tick all covered with follow-ups.
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
  '## BEAT: 11 · Event Outcome', 'Marcus Hale: So you are the Lala everyone wants to get to know.', 'Lala: "Time to follow up with Velour about the collab."',
  '## BEAT: 14 · Cliffhanger', 'Me: bye',
].join('\n');
const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Velour Night', canon_consequences: { automation: {
  relationship_goals: [{ slot: 'relationship_guest', label: 'Get to know Truthville', profile_id: 9 }, { slot: 'relationship_brand', label: 'Co-style a moment with Velour' }],
  guest_profiles: [{ profile_id: 9, display_name: 'Truthville', handle: 'truthville' }],
} } };
const GUEST = { slot: 'relationship_guest', label: 'Get to know Truthville', task_source: 'goal', completed: false };
const BRAND = { slot: 'relationship_brand', label: 'Co-style a moment with Velour', task_source: 'goal', completed: false };
const CARRIED = { slot: 'follow_up_f1', label: 'Follow up with Velour about the collab', task_source: 'goal', follow_up_id: 'f1', completed: false };

let social;
let brief;
const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const openCover = async () => fireEvent.click(await screen.findByTestId('script-side-tab-cover'));
const done = (slot, completed = true) => social.map((t) => (t.slot === slot ? { ...t, completed } : t));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  social = [GUEST, BRAND, CARRIED];
  brief = { event_id: 'ev-1', forward_hook: 'A second invitation arrives', event_metadata: {} };
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: brief } };
    if (url === '/api/v1/world/show-1/events/ev-1') return { data: { event: EVENT } };
    if (url === '/api/v1/social-profiles/9') return { data: { profile: { id: 9, creator_name: 'Marcus Hale', display_name: 'Truthville', handle: 'truthville' } } };
    if (url === '/api/v1/episodes/ep-1/todo/social') return { data: { success: true, social_tasks: social } };
    return { data: { data: [] } };
  });
  vi.mocked(api.post).mockImplementation(async (url, body) => {
    const slot = decodeURIComponent(url.split('/').pop());
    social = done(slot, body.completed);
    return { data: { success: true, social_tasks: social } };
  });
});

test('Mark covered on an open item saves her mark, and it reads Marked by you; Undo mark takes it back', async () => {
  let marks = {};
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    if (body.covered === null) delete marks[body.key]; else marks = { ...marks, [body.key]: { covered: body.covered, at: 'now', by: 'u1' } };
    return { data: { data: { cover_marks: marks } } };
  });
  renderTab();
  await openCover();
  await waitFor(() => expect(screen.getByTestId('script-cover-hook').dataset.covered).toBe('false'));
  fireEvent.click(screen.getByTestId('script-cover-hook-mark'));
  expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/cover-marks', { key: 'hook', covered: true });
  await waitFor(() => expect(screen.getByTestId('script-cover-hook').dataset.covered).toBe('true'));
  expect(screen.getByTestId('script-cover-hook-marked').textContent).toBe('Marked by you');
  expect(screen.getByTestId('script-cover-hook-mark').textContent).toBe('Undo mark');
  fireEvent.click(screen.getByTestId('script-cover-hook-mark'));
  expect(api.put).toHaveBeenLastCalledWith('/api/v1/episode-brief/ep-1/cover-marks', { key: 'hook', covered: null });
  await waitFor(() => expect(screen.getByTestId('script-cover-hook').dataset.covered).toBe('false'));
});

test('Not covered on one the words ticked; a saved mark is read with the brief', async () => {
  brief = { ...brief, event_metadata: { cover_marks: { 'goal:relationship_guest:get-to-know-truthville': { covered: false, at: 'then', by: 'u1' } } } };
  renderTab();
  await openCover();
  await waitFor(() => expect(screen.getByTestId('script-cover-goal-0-marked')).toBeTruthy());
  expect(screen.getByTestId('script-cover-goal-0').dataset.covered).toBe('false');
  expect(screen.getByTestId('script-cover-goal-0-marked').textContent).toBe('Marked by you: not covered');
  // The follow-up the words ticked offers Not covered.
  expect(screen.getByTestId('script-cover-carried-f1-mark').textContent).toBe('Not covered');
});

test('Tick all covered takes the follow-ups too; every Tick waits while one is in flight', async () => {
  let release;
  const ok = vi.mocked(api.post).getMockImplementation();
  vi.mocked(api.post).mockImplementation((url, body) => new Promise((resolve) => { release = () => resolve(ok(url, body)); }));
  renderTab();
  await openCover();
  await waitFor(() => expect(screen.getByTestId('script-cover-tick-all').textContent).toContain('Tick all covered (2)'));
  fireEvent.click(screen.getByTestId('script-cover-goal-0-tick'));
  await waitFor(() => expect(screen.getByTestId('script-cover-carried-f1-tick').disabled).toBe(true));
  expect(screen.getByTestId('script-cover-tick-all').disabled).toBe(true);
  release();
  await waitFor(() => expect(screen.getByTestId('script-cover-goal-0-ticked')).toBeTruthy());
  vi.mocked(api.post).mockImplementation(ok);
  fireEvent.click(screen.getByTestId('script-cover-tick-all'));
  expect((await screen.findByTestId('script-cover-tick-all-done')).textContent).toBe('Ticked 1 goal.');
  expect(api.post).toHaveBeenLastCalledWith('/api/v1/episodes/ep-1/todo/complete/follow_up_f1', { completed: true, source: 'script', beat: 11 });
});

test('Untick posts completed false', async () => {
  social = done('relationship_guest');
  renderTab();
  await openCover();
  fireEvent.click(await screen.findByTestId('script-cover-goal-0-untick'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo/complete/relationship_guest', { completed: false, source: 'script' }));
  expect(await screen.findByTestId('script-cover-goal-0-tick')).toBeTruthy();
});

test('with unsaved changes, Tick it says Save first and does nothing', async () => {
  renderTab();
  await openCover();
  await screen.findByTestId('script-cover-goal-0-tick');
  fireEvent.click(screen.getByText('Raw editor'));
  fireEvent.change(screen.getByLabelText('Raw script'), { target: { value: `${SCRIPT}\nKelli: "New line."` } });
  const tick = await screen.findByTestId('script-cover-goal-0-tick');
  expect(tick.textContent).toBe('Save first');
  expect(tick.disabled).toBe(true);
  expect(screen.getByTestId('script-cover-tick-all').textContent).toContain('Save first');
});
