/**
 * The Script tab's beat card says which to-do list Lala's phone shows and
 * what of the deal is delivered by then; [DELIVER] and [TODO_MODE] cues that
 * do nothing are flagged beside the wear flags (Task 3191).
 */
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = [
  '## BEAT: 8 · Transformation Loop',
  '[UI:OPEN Closet]',
  'Lala: "This one."',
  '## BEAT: 10 · Location',
  'Lala: "Rolling."',
  '[DELIVER: d-reel]',
  '[DELIVER: d-gone]',
  '[TODO_MODE: banana]',
  '## BEAT: 11 · Arrival',
  '[TODO_MODE: career]',
].join('\n');
const DEAL = {
  label: "At STUDIO BY SABLE's Studio",
  locked: true,
  items: [
    { deliverable_id: 'd-reel', label: 'One reel', status: 'pending' },
    { deliverable_id: 'd-story', label: 'Three stories', status: 'pending' },
  ],
};

const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episodes/ep-1/todo/at') return { data: { data: { mode: 'deal', deal: DEAL } } };
    if (url === '/api/v1/ui-overlays/show-1/frame') return { data: { frame_url: null } };
    return { data: { data: [] } };
  });
});

const openBeat = async (n) => {
  const list = await screen.findByTestId('script-beatlist');
  fireEvent.click([...list.querySelectorAll('button')].find((b) => b.textContent.includes(String(n))));
};

test('through the closet beat her phone shows the Shopping list', async () => {
  renderTab();
  const row = await screen.findByTestId('script-truth-todo');
  expect(row.dataset.mode).toBe('shopping');
  expect(row.textContent).toContain('Shopping list');
});

test('at the deal: the location, what is delivered by the end of the beat, ready to approve; bad cues flagged', async () => {
  renderTab();
  await openBeat(10);
  await screen.findByText(/1 of 2 delivered/);
  const row = screen.getByTestId('script-truth-todo');
  expect(row.dataset.mode).toBe('deal');
  expect(row.textContent).toContain("At STUDIO BY SABLE's Studio · 1 of 2 delivered · ready to approve in Money");
  expect(screen.getAllByTestId('script-deliver-flag').map((f) => [f.dataset.flag, f.textContent])).toEqual([
    ['not_this_event', '[DELIVER: d-gone] is not a deliverable of this event'],
    ['bad_mode', '[TODO_MODE: banana] is not shopping, deal or career'],
  ]);
  expect(api.post).not.toHaveBeenCalled();
});

test("a beat's own [TODO_MODE] wins", async () => {
  renderTab();
  await openBeat(11);
  const row = await screen.findByTestId('script-truth-todo');
  expect(row.dataset.mode).toBe('career');
  expect(row.textContent).toContain('Career list (set in this beat)');
});
