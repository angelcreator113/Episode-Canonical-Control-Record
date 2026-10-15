/**
 * Safety on the Script tab (Script tab audit, 2026-10-15):
 * - History lists the scripts a save, lock or Regenerate replaced, shows
 *   one, and puts it back on the page as an unsaved change;
 * - unsaved edits are kept in this browser and offered back on return;
 * - a rewrite or regenerated beat is a suggestion: "Keep mine" leaves the
 *   script as it is.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const OLD = '## BEAT: 1 · Opening Ritual\nLala: The first draft.';
const VID = '3f2a9c1e-0000-4000-8000-000000000001';
const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const raw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return screen.getByRole('textbox', { name: 'Raw script' }).value; };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  window.localStorage.clear();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episodes/ep-1/script-versions') {
      return { data: { data: [{ id: VID, created_at: '2026-10-15T01:00:00Z', source: 'generate', beats: 1, preview: 'Lala: The first draft.' }] } };
    }
    if (url === `/api/v1/episodes/ep-1/script-versions/${VID}`) {
      return { data: { data: { id: VID, created_at: '2026-10-15T01:00:00Z', source: 'generate', beats: 1, script_content: OLD } } };
    }
    return { data: { data: [] } };
  });
});
afterEach(() => { window.localStorage.clear(); });

describe('History', () => {
  test('lists, shows and puts a version back as an unsaved change', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-history'));
    const item = await screen.findByTestId('script-history-item');
    expect(item.textContent).toContain('Before Regenerate');
    expect(item.textContent).toContain('Lala: The first draft.');
    fireEvent.click(item);
    expect((await screen.findByTestId('script-history-text')).textContent).toBe(OLD);
    fireEvent.click(screen.getByTestId('script-history-restore'));
    expect(screen.queryByTestId('script-history-panel')).toBeNull();
    expect(screen.getByTestId('script-dirty')).toBeTruthy();
    expect(raw()).toBe(OLD);
    expect(api.put).not.toHaveBeenCalled();
  });

  test('with unsaved changes it asks first', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      renderTab();
      fireEvent.click(screen.getByTestId('script-beat-down-1'));
      fireEvent.click(screen.getByTestId('script-history'));
      fireEvent.click(await screen.findByTestId('script-history-item'));
      fireEvent.click(await screen.findByTestId('script-history-restore'));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('script-history-panel')).toBeTruthy();
    } finally { confirm.mockRestore(); }
  });
});

describe('Unsaved changes kept in this browser', () => {
  test('are written while unsaved, offered back on return, and put back', async () => {
    const first = renderTab();
    fireEvent.click(screen.getByTestId('script-beat-down-1'));
    await waitFor(() => expect(window.localStorage.getItem('esp-draft-ep-1')).toContain('Logging in'), { timeout: 2000 });
    const kept = JSON.parse(window.localStorage.getItem('esp-draft-ep-1')).text;
    first.unmount();

    renderTab();
    expect(screen.getByTestId('script-draft').textContent).toContain('were kept in this browser');
    fireEvent.click(screen.getByTestId('script-draft-restore'));
    expect(screen.queryByTestId('script-draft')).toBeNull();
    expect(raw()).toBe(kept);
  });

  test('Discard drops them', async () => {
    window.localStorage.setItem('esp-draft-ep-1', JSON.stringify({ text: OLD, base: SCRIPT, at: Date.now() }));
    renderTab();
    fireEvent.click(screen.getByTestId('script-draft-discard'));
    expect(screen.queryByTestId('script-draft')).toBeNull();
    await waitFor(() => expect(window.localStorage.getItem('esp-draft-ep-1')).toBeNull(), { timeout: 2000 });
    expect(raw()).toBe(SCRIPT);
  });

  test('a kept copy that is the saved script is not offered', () => {
    window.localStorage.setItem('esp-draft-ep-1', JSON.stringify({ text: SCRIPT, base: SCRIPT, at: Date.now() }));
    renderTab();
    expect(screen.queryByTestId('script-draft')).toBeNull();
  });
});

describe('A suggestion waits for "Use it"', () => {
  test('Keep mine leaves the beat as it is', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { beat: '## BEAT: 2 · Login Sequence\nLala: Fresh login.' } });
    renderTab();
    fireEvent.click(screen.getByTestId('script-beat-2').querySelector('.esp-beat-head'));
    fireEvent.click(screen.getByTestId('script-regen-beat-2'));
    const card = await screen.findByTestId('script-proposal');
    expect(within(card).getByText('Lala: Fresh login.')).toBeTruthy();
    expect(screen.queryByTestId('script-dirty')).toBeNull();
    fireEvent.click(screen.getByTestId('script-proposal-discard'));
    expect(screen.queryByTestId('script-proposal')).toBeNull();
    expect(raw()).toBe(SCRIPT);
  });
});
