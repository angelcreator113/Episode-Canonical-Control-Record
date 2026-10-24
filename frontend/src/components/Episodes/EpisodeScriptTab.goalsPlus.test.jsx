/**
 * Goals ticked from the script (Evoni, 2026-10-23): under "Covered in beat
 * N" the line that covered it, the name emphasised; the brand goal ticks
 * by the brand's names; Tick all covered ticks every covered goal not yet
 * ticked, each with its beat, says how many, and is gone when none is left.
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
  '## BEAT: 3 · Getting Ready', 'Lala: "Tonight is the night."',
  '## BEAT: 11 · Event Outcome', 'Truth: So you are the Lala everyone wants to get to know.', 'Lala: "Sable, let us co-style a moment."',
].join('\n');
const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Velour Night', host_brand: 'Studio by Sable', canon_consequences: { automation: {
  relationship_goals: [
    { slot: 'relationship_guest', label: 'Get to know Truthville', profile_id: 9 },
    { slot: 'relationship_brand', label: 'Co-style a moment with Studio by Sable', profile_id: 40 },
    { slot: 'relationship_host', label: 'Follow up with Celeste Rue after the event' },
  ],
  guest_profiles: [{ profile_id: 9, display_name: 'Truthville', handle: 'truthville' }],
} } };
const PROFILES = {
  9: { id: 9, creator_name: 'Marcus Hale', display_name: 'Truthville', handle: 'truthville', aliases: ['Truth'] },
  40: { id: 40, display_name: 'Studio by Sable', handle: 'studiobysable', aliases: ['Sable'] },
};
const task = (slot, label, completed = false) => ({ slot, label, task_source: 'goal', completed });

let social;
const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const openCover = async () => fireEvent.click(await screen.findByTestId('script-side-tab-cover'));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  social = [
    task('relationship_guest', 'Get to know Truthville'),
    task('relationship_brand', 'Co-style a moment with Studio by Sable'),
    task('relationship_host', 'Follow up with Celeste Rue after the event'),
  ];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { event_id: 'ev-1' } } };
    if (url === '/api/v1/world/show-1/events/ev-1') return { data: { event: EVENT } };
    const m = url.match(/^\/api\/v1\/social-profiles\/(\d+)$/);
    if (m) return { data: { profile: PROFILES[m[1]] || null } };
    if (url === '/api/v1/episodes/ep-1/todo/social') return { data: { success: true, social_tasks: social } };
    return { data: { data: [] } };
  });
  // Each tick writes the list, as the server does: the slot done.
  vi.mocked(api.post).mockImplementation(async (url) => {
    const slot = decodeURIComponent(url.split('/').pop());
    social = social.map((t) => (t.slot === slot ? { ...t, completed: true } : t));
    return { data: { success: true, social_tasks: social } };
  });
});

test('the line that covered it is quoted, the name it was matched by in bold', async () => {
  renderTab();
  await openCover();
  await waitFor(() => expect(screen.getByTestId('script-cover-goal-0').dataset.covered).toBe('true'));
  const quote = screen.getByTestId('script-cover-goal-0-quote');
  expect(quote.textContent).toBe('“Truth: So you are the Lala everyone wants to get to know.”');
  expect(quote.querySelector('strong').textContent).toBe('Truth');
  expect(screen.getByTestId('script-cover-goal-0-where').textContent).toBe('Covered in beat 11 · Truthville, as Truth');
  // The brand goal, by the brand's other name.
  expect(screen.getByTestId('script-cover-goal-1').dataset.covered).toBe('true');
  expect(screen.getByTestId('script-cover-goal-1-quote').querySelector('strong').textContent).toBe('Sable');
  // Not covered: no quote.
  expect(screen.getByTestId('script-cover-goal-2').dataset.covered).toBe('false');
  expect(screen.queryByTestId('script-cover-goal-2-quote')).toBeNull();
});

test('Tick all covered ticks each covered goal with its beat, says how many, then is gone', async () => {
  renderTab();
  await openCover();
  const all = await screen.findByTestId('script-cover-tick-all');
  expect(all.textContent).toContain('Tick all covered (2)');
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(all);
  expect((await screen.findByTestId('script-cover-tick-all-done')).textContent).toBe('Ticked 2 goals.');
  expect(api.post.mock.calls).toEqual([
    ['/api/v1/episodes/ep-1/todo/complete/relationship_guest', { completed: true, source: 'script', beat: 11 }],
    ['/api/v1/episodes/ep-1/todo/complete/relationship_brand', { completed: true, source: 'script', beat: 11 }],
  ]);
  expect(screen.queryByTestId('script-cover-tick-all')).toBeNull();
  expect(screen.getByTestId('script-cover-goal-0-ticked')).toBeTruthy();
  expect(screen.getByTestId('script-cover-goal-1-ticked')).toBeTruthy();
});

test('one covered goal left: it counts one; none left, no button', async () => {
  social = social.map((t) => (t.slot === 'relationship_guest' ? { ...t, completed: true } : t));
  const first = renderTab();
  await openCover();
  fireEvent.click(await screen.findByTestId('script-cover-tick-all'));
  expect((await screen.findByTestId('script-cover-tick-all-done')).textContent).toBe('Ticked 1 goal.');
  expect(api.post).toHaveBeenCalledTimes(1);
  first.unmount();
  renderTab();
  await openCover();
  await screen.findByTestId('script-cover-goal-1-ticked');
  expect(screen.queryByTestId('script-cover-tick-all')).toBeNull();
});

test('one that fails says so on its row; the rest still tick', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const ok = vi.mocked(api.post).getMockImplementation();
  vi.mocked(api.post).mockImplementation(async (url, body) => {
    if (url.endsWith('relationship_guest')) throw new Error('down');
    return ok(url, body);
  });
  renderTab();
  await openCover();
  fireEvent.click(await screen.findByTestId('script-cover-tick-all'));
  expect((await screen.findByTestId('script-cover-tick-all-done')).textContent).toBe('Ticked 1 goal.');
  expect((await screen.findByRole('alert')).textContent).toContain("Couldn't tick it");
  expect(screen.getByTestId('script-cover-tick-all').textContent).toContain('(1)');
});
