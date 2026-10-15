/**
 * Delete a line, and editing lines from the keyboard (Script tab audit,
 * 2026-10-15).
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab, { scriptWithoutLine } from './EpisodeScriptTab';

const SCRIPT = '[EVENT: name="Gala"]\n\n## BEAT: 1 · Opening Ritual\nMe: Hi besties.\nLala: Hey bestie.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = (locked = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: locked }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const lines = (n) => within(screen.getByTestId(`script-beat-${n}`)).queryAllByTestId('script-line');

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
});
afterEach(() => vi.restoreAllMocks());

describe('scriptWithoutLine', () => {
  test('takes one line out of one beat; the rest stays exactly', () => {
    expect(scriptWithoutLine(SCRIPT, [], 'beat-1', 0)).toBe('[EVENT: name="Gala"]\n\n## BEAT: 1 · Opening Ritual\nLala: Hey bestie.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.');
  });
  test('a locked beat, a missing beat or a missing line is null', () => {
    expect(scriptWithoutLine(SCRIPT, [1], 'beat-1', 0)).toBeNull();
    expect(scriptWithoutLine(SCRIPT, [], 'beat-9', 0)).toBeNull();
    expect(scriptWithoutLine(SCRIPT, [], 'beat-1', 5)).toBeNull();
    expect(scriptWithoutLine(SCRIPT, [], 'beat-1', -1)).toBeNull();
  });
});

describe('Delete line', () => {
  test('asks first, then takes the line out, unsaved until Save', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTab();
    fireEvent.click(lines(1)[0]);
    fireEvent.click(screen.getByTestId('script-line-delete'));
    expect(ask).toHaveBeenCalledWith('Delete this line?');
    expect(lines(1)).toHaveLength(1);
    expect(lines(1)[0].textContent).toContain('Hey bestie.');
    expect(screen.getByTestId('script-dirty')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).not.toContain('Hi besties.');
  });

  test('No keeps the line, and the editor stays open', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab();
    fireEvent.click(lines(1)[0]);
    fireEvent.click(screen.getByTestId('script-line-delete'));
    expect(screen.getByRole('textbox', { name: 'Edit line' })).toBeTruthy();
    expect(screen.queryByTestId('script-dirty')).toBeNull();
  });
});

describe('Lines from the keyboard', () => {
  test('a line is a button named for its words; Enter opens it, Escape cancels', () => {
    renderTab();
    const line = lines(1)[0];
    expect(line.getAttribute('role')).toBe('button');
    expect(line.getAttribute('tabindex')).toBe('0');
    expect(line.getAttribute('aria-label')).toBe('Edit line: Prime: Hi besties.');
    fireEvent.keyDown(line, { key: 'Enter' });
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Me: Changed.' } });
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Edit line' })).toBeNull();
    expect(lines(1)[0].textContent).toContain('Hi besties.');
  });

  test('Space opens it; Ctrl+Enter keeps the line', () => {
    renderTab();
    fireEvent.keyDown(lines(1)[0], { key: ' ' });
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Me: Changed.' } });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    expect(screen.queryByRole('textbox', { name: 'Edit line' })).toBeNull();
    expect(lines(1)[0].textContent).toContain('Changed.');
    expect(screen.getByTestId('script-dirty')).toBeTruthy();
  });

  test('Cmd+S in the line editor is still the tab save', async () => {
    renderTab();
    fireEvent.keyDown(lines(1)[1], { key: 'Enter' });
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: New words.' } });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(lines(1)[0], { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit line' }), { key: 's', metaKey: true });
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).toContain('Lala: New words.');
  });

  test("a locked beat's lines are not buttons", () => {
    renderTab([1]);
    expect(lines(1)[0].getAttribute('role')).toBeNull();
    expect(lines(1)[0].getAttribute('tabindex')).toBeNull();
  });
});
