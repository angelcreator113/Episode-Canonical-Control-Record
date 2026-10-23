/**
 * The Script tab flags wardrobe cues that name no single piece of the locked
 * look (Task 3180; Evoni, 2026-10-14): a [WEAR] id the look doesn't hold, an
 * older [UI:SELECT Item <name>] matching no piece or several. Flags only;
 * nothing is changed. Nothing is checked before a look is locked.
 */
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = [
  '## BEAT: 8 · Transformation Loop',
  '[UI:OPEN Closet]',
  '[WEAR: dress-1]',
  '[UI:SELECT Item Pearl Drop]',
  '[UI:SELECT Item Velvet Hat]',
  '[WEAR: gone-9]',
  'Lala: "Okay."',
].join('\n');
let outfit;
let spent;

const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  spent = 1240;
  outfit = [
    { id: 'dress-1', name: 'Crimson Gown' },
    { id: 'ear-1', name: 'Pearl Drop' },
    { id: 'ear-2', name: 'Pearl Drop' },
  ];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/wardrobe/outfit/ep-1') return { data: { items: outfit } };
    if (url === '/api/v1/ui-overlays/show-1/frame') return { data: { frame_url: null } };
    if (url === '/api/v1/episodes/ep-1/todo?beat=8') {
      return { data: { data: { tasks: [{ slot: 'dress', label: 'A showstopper', completed: true }, { slot: 'shoes', label: 'Heels', completed: false }], completion: { completed: 1, total: 2 }, spent_so_far: spent } } };
    }
    return { data: { data: [] } };
  });
});

test('the open beat lists each wear cue that names no single piece, in plain words', async () => {
  renderTab();
  // The context panel is tabs (Evoni, 2026-10-22 layout list).
  fireEvent.click(await screen.findByTestId('script-side-tab-checks'));
  const panel = await screen.findByTestId('script-wear-check');
  expect(panel.textContent).toContain('Wardrobe cues · Beat 8');
  const flags = screen.getAllByTestId('script-wear-flag');
  expect(flags.map((f) => [f.dataset.flag, f.textContent])).toEqual([
    ['several', '"Pearl Drop" matches several pieces of the look; use [WEAR: id]'],
    ['no_match', '"Velvet Hat" matches no piece of the look'],
    ['not_in_look', '[WEAR: gone-9] is not a piece of the locked look'],
    // No cue puts either Pearl Drop on; this is the closet beat (Task 3188).
    ['uncued', '"Pearl Drop" is in the look, never equipped on screen'],
    ['uncued', '"Pearl Drop" is in the look, never equipped on screen'],
  ]);
});

test('the open beat says how much of the Shopping list is crossed off by then (Task 3188)', async () => {
  renderTab();
  const row = await screen.findByTestId('script-truth-shopping');
  expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo?beat=8');
  expect(row.textContent).toContain('1 of 2 crossed off');
  expect(row.textContent).toContain('A showstopper');
  expect(row.textContent).not.toContain('Heels');
});

test('beside the coins, what the look has cost by this beat; nothing when nothing is spent (Task 3189)', async () => {
  renderTab();
  expect((await screen.findByTestId('script-truth-spent')).textContent).toBe('Spent on the look so far: 🪙 1,240');
  expect(screen.getByTestId('script-truth-coins').contains(screen.getByTestId('script-truth-spent'))).toBe(true);
});

test('spent so far is hidden at zero', async () => {
  spent = 0;
  renderTab();
  await screen.findByTestId('script-truth-shopping');
  expect(screen.queryByTestId('script-truth-spent')).toBeNull();
});

test('before a look is locked, nothing is checked', async () => {
  outfit = [];
  renderTab();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/wardrobe/outfit/ep-1'));
  expect(screen.queryByTestId('script-wear-check')).toBeNull();
});
