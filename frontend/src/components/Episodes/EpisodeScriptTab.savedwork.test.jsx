/**
 * The Script tab keeps its work (Script tab audit, 2026-10-15):
 * - the raw editor is the script itself, so a line edit shows there and
 *   typing in it does not bring back the old line;
 * - clearing the raw editor leaves it open, so the text can be pasted back;
 * - Ctrl/Cmd+S saves the script;
 * - each save goes back to the episode page (onSaved), and the page is told
 *   whether there are unsaved edits (onDirtyChange).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\n(Lala opens the closet)\nLala: "Hi besties."\n';
const renderTab = (props = {}) => render(
  <MemoryRouter>
    <EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT }} show={{ id: 'show-1' }} {...props} />
  </MemoryRouter>,
);
const REV = `sr1-${'a'.repeat(40)}`; // the saved script's revision (A1c R1), as GET /episodes/:id gives it
const raw = () => screen.getByRole('textbox', { name: 'Raw script' });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/episodes/ep-1'
    ? { data: { data: { id: 'ep-1', script_content: SCRIPT, script_locked_beats: [] }, script_revision: REV } }
    : { data: { data: [] } }));
  vi.mocked(api.put).mockImplementation(async (_url, body) => ({ data: { success: true, data: { script_content: body.script_content } } }));
});

describe('EpisodeScriptTab: saved work', () => {
  test('a line edit shows in the raw editor, and typing there keeps it', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('(Lala opens the closet)'));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: '(Lala opens the wardrobe)' } });
    fireEvent.click(within(box.closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));

    fireEvent.click(screen.getByRole('button', { name: 'Raw editor' }));
    expect(raw().value).toContain('(Lala opens the wardrobe)');
    expect(raw().value).not.toContain('(Lala opens the closet)');

    fireEvent.change(raw(), { target: { value: `${raw().value}Lala: "Bye."\n` } });
    expect(raw().value).toContain('(Lala opens the wardrobe)');
  });

  test('clearing the raw editor leaves it open', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Raw editor' }));
    fireEvent.change(raw(), { target: { value: '' } });
    expect(raw().value).toBe('');
    fireEvent.change(raw(), { target: { value: SCRIPT } });
    expect(raw().value).toBe(SCRIPT);
  });

  test('Ctrl+S saves the script, and the save goes back to the episode page', async () => {
    const onSaved = vi.fn();
    const onDirtyChange = vi.fn();
    renderTab({ onSaved, onDirtyChange });
    fireEvent.click(await screen.findByRole('button', { name: 'Raw editor' }));
    const next = `${SCRIPT}Lala: "Bye."\n`;
    fireEvent.change(raw(), { target: { value: next } });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episodes/ep-1', { script_content: next, script_revision: REV }));
    await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith({ id: 'ep-1', script_content: next, script_locked_beats: [] }));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  test('Ctrl+S with nothing unsaved does not save', async () => {
    const onSaved = vi.fn();
    renderTab({ onSaved });
    await screen.findByRole('button', { name: 'Raw editor' });
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    expect(api.put).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  test('approving a beat sends its lock back to the episode page', async () => {
    const onSaved = vi.fn();
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: { script_locked_beats: [1] } } });
    renderTab({ onSaved });
    fireEvent.click(await screen.findByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith({ id: 'ep-1', script_content: SCRIPT, script_locked_beats: [1] }));
  });
});
