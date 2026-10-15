/**
 * The Script tab's smaller findings (Script tab audit, 2026-10-15):
 * - Regenerate asks once, not twice, when no beat is approved;
 * - at phone width the open beat's header doesn't close it (no beat showed);
 * - Approve & lock with unsaved edits drafts Lala's posts, as Save does;
 * - the shopping list is read again after a save, not on every keystroke;
 * - the wardrobe card reads "before the closet" by place, as the to-do card does.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';
import { beatState } from '../../lib/beatState';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = (script = SCRIPT) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const todoCalls = () => vi.mocked(api.get).mock.calls.filter(([url]) => url.startsWith('/api/v1/episodes/ep-1/todo?beat=')).length;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});
afterEach(() => { vi.restoreAllMocks(); });

test('Regenerate with nothing approved asks once and sends the confirmation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.mocked(api.post).mockResolvedValue({ data: { saved: true, script: SCRIPT } });
  renderTab();
  fireEvent.click(screen.getByTestId('script-regenerate'));
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ confirmOverwrite: true });
});

test("at phone width the open beat's header leaves it open", () => {
  vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ matches: q.includes('760'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  renderTab();
  const beat = screen.getByTestId('script-beat-1');
  expect(beat.className).toContain('is-open');
  fireEvent.click(beat.querySelector('.esp-beat-head'));
  expect(screen.getByTestId('script-beat-1').className).toContain('is-open');
});

test("Approve & lock with an unsaved Post drafts Lala's posts", async () => {
  vi.mocked(api.put).mockImplementation(async (_url, body) => ({ data: { data: { script_locked_beats: body.locked_beats, script_content: body.script_content } } }));
  vi.mocked(api.post).mockResolvedValue({ data: { data: [] } });
  renderTab(`${SCRIPT}`);
  fireEvent.click(screen.getByRole('button', { name: 'Raw editor' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Raw script' }), { target: { value: SCRIPT.replace('Lala: Hi besties.', 'Lala: Hi besties.\n[UI:POST Gala night]') } });
  fireEvent.click(screen.getByRole('button', { name: 'Beat view' }));
  fireEvent.click(screen.getByTestId('script-lock-1'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts/episodes/ep-1/script-drafts'));
});

test('the shopping list is read again after a save, not on a keystroke', async () => {
  vi.mocked(api.put).mockImplementation(async (_url, body) => ({ data: { data: { script_content: body.script_content } } }));
  renderTab();
  await waitFor(() => expect(todoCalls()).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: 'Raw editor' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Raw script' }), { target: { value: `${SCRIPT}\nLala: More.` } });
  expect(todoCalls()).toBe(1);
  fireEvent.click(screen.getByTestId('script-savebar-save'));
  await waitFor(() => expect(todoCalls()).toBe(2));
});

describe('beatState: before the closet by place', () => {
  test('a beat moved ahead of the closet beat is still getting dressed', () => {
    const beats = [{ number: 1, lines: [] }, { number: 8, lines: [] }, { number: 5, lines: [] }];
    expect(beatState(beats, 2, { closetAt: 8 }).wearing.beforeCloset).toBeFalsy();
    expect(beatState(beats, 0, { closetAt: 8 }).wearing.beforeCloset).toBe(true);
  });
});
