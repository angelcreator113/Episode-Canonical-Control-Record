/**
 * The Script tab offers Lala's line after a piece she puts on (Task 3190;
 * Evoni, 2026-10-14, phone phase 3 ruling 5): a slot under each wear cue with
 * no line of hers right after it, its draft from a free template; Insert
 * writes it after the cue. Nothing is written without the click; no AI call.
 */
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';
import { draftLine } from '../../lib/lalaLineDraft';

const SCRIPT = [
  '## BEAT: 8 · Transformation Loop',
  '[UI:OPEN Closet]',
  '[WEAR: dress-1]',
  'Lala: "This one."',
  '[WEAR: shoe-1]',
  'Prime: "Nice."',
].join('\n');
const OUTFIT = [
  { id: 'dress-1', name: 'Crimson Gown', clothing_category: 'dress', coin_cost: 900, tier: 'luxury' },
  { id: 'shoe-1', name: 'Satin Pump', clothing_category: 'shoes', coin_cost: 120, tier: 'mid' },
];

const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/wardrobe/outfit/ep-1') return { data: { items: OUTFIT } };
    if (url === '/api/v1/ui-overlays/show-1/frame') return { data: { frame_url: null } };
    return { data: { data: [] } };
  });
});

const lineTexts = () => [...document.querySelectorAll('.esp-lines > *')].map((el) => el.textContent);

test('a slot follows a wear cue with no line of hers after it, and none where she already speaks', async () => {
  renderTab();
  const slots = await screen.findAllByTestId('script-lala-slot');
  expect(slots).toHaveLength(1);
  const draft = draftLine(OUTFIT[1], { dressCode: '' });
  expect(screen.getByTestId('script-lala-draft').textContent).toBe(`“${draft}”`);
  // The slot sits right under the shoe's cue.
  const texts = lineTexts();
  const slotAt = texts.findIndex((t) => t.includes("Add Lala's line"));
  expect(texts[slotAt + 1]).toContain('Nice.');
  expect(api.put).not.toHaveBeenCalled();
});

test('Insert writes her line right after the cue, and the slot goes', async () => {
  renderTab();
  fireEvent.click(await screen.findByTestId('script-lala-insert'));
  const draft = draftLine(OUTFIT[1], { dressCode: '' });
  await waitFor(() => expect(screen.queryByTestId('script-lala-slot')).toBeNull());
  const texts = lineTexts();
  const nice = texts.findIndex((t) => t.includes('Nice.'));
  expect(texts[nice - 1]).toContain(draft);
  // Inserted into the editor only; saving stays Evoni's click.
  expect(api.put).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
