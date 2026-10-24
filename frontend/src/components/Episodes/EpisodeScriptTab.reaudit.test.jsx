/**
 * Script page re-audit (2026-10-19):
 * - an open line editor stays with its own line when an identical line is
 *   added above it or deleted before it;
 * - no edit goes in while a lock is on its way;
 * - Escape closes only the dialog on top;
 * - a bar tap shows an adder already open instead of replacing it;
 * - Delete and Move give focus back to a line's row.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
import api from '../../services/api';
import EpisodeScriptTab, { nextLineIds } from './EpisodeScriptTab';

const DUP = '## BEAT: 1 · Opening Ritual\n(beat)\nLala: A.\n(beat)\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const DUP2 = '## BEAT: 1 · Opening Ritual\n(beat)\n(beat)\nLala: A.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\nLala: Second line.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = (script = SCRIPT) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const beat1Lines = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Raw editor' }));
  return screen.getByRole('textbox', { name: 'Raw script' }).value.split('\n\n')[0].split('\n').slice(1);
};
const editor = () => screen.getByRole('textbox', { name: 'Edit line' });
const editorSave = () => fireEvent.click(within(editor().closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  window.localStorage.clear();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.endsWith('/plan')) return { data: { data: [{ beat_number: 1, sceneSet: { name: 'Loft' } }] } };
    return { data: { data: [] } };
  });
});
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

describe('an open editor stays with its line', () => {
  test('nextLineIds follows a splice or a move, and falls back to the longest match', () => {
    let n = 0;
    const id = () => `n${++n}`;
    expect(nextLineIds(['a', 'L', 'a'], ['x', 'y', 'z'], ['a', 'a', 'L', 'a'], { kind: 'splice', at: 1, removed: 0 }, id)).toEqual(['x', 'n1', 'y', 'z']);
    expect(nextLineIds(['a', 'a', 'L'], ['x', 'y', 'z'], ['a', 'L'], { kind: 'splice', at: 0, removed: 1 }, id)).toEqual(['y', 'z']);
    expect(nextLineIds(['a', 'b', 'a'], ['x', 'y', 'z'], ['b', 'a', 'a'], { kind: 'move', from: 0, to: 2 }, id)).toEqual(['y', 'z', 'x']);
    // An op that doesn't describe the change is ignored.
    expect(nextLineIds(['a', 'L', 'b'], ['x', 'y', 'z'], ['L', 'b'], { kind: 'splice', at: 2, removed: 1 }, id)).toEqual(['y', 'z']);
  });

  test('an identical line added above: Save changes the line that was open', () => {
    renderTab(DUP);
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getAllByText('(beat)')[1]);
    fireEvent.change(editor(), { target: { value: '(long pause)' } });
    fireEvent.click(screen.getByTestId('script-add-action-1'));
    const adder = screen.getByTestId('script-line-adder');
    fireEvent.change(within(adder).getByTestId('script-line-adder-where'), { target: { value: '0' } });
    fireEvent.change(within(adder).getByTestId('script-line-adder-text'), { target: { value: 'beat' } });
    fireEvent.click(within(adder).getByTestId('script-line-adder-add'));
    expect(editor().value).toBe('(long pause)');
    editorSave();
    expect(beat1Lines()).toEqual(['(beat)', '(beat)', 'Lala: A.', '(long pause)']);
  });

  test('an identical line deleted before it: the editor and its words stay', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTab(DUP2);
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getAllByText('(beat)')[1]);
    fireEvent.change(editor(), { target: { value: '(long pause)' } });
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getAllByText('(beat)')[0]);
    expect(screen.getAllByRole('textbox', { name: 'Edit line' })).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId('script-line-delete')[0]);
    expect(editor().value).toBe('(long pause)');
    editorSave();
    expect(beat1Lines()).toEqual(['(long pause)', 'Lala: A.']);
  });
});

describe('no edits while a lock is on its way', () => {
  test('Save in a line editor waits for the lock, and keeps the words', async () => {
    const reply = deferred();
    vi.mocked(api.put).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties/));
    fireEvent.change(editor(), { target: { value: 'Lala: Changed while locking.' } });
    fireEvent.click(screen.getByTestId('script-lock-1'));
    editorSave();
    expect(await screen.findByText('Wait for the lock to finish.')).toBeTruthy();
    expect(editor().value).toBe('Lala: Changed while locking.');
    await act(async () => { reply.resolve({ data: { data: { script_locked_beats: [1] } } }); });
    expect(screen.getByTestId('script-lock-1').textContent).toBe('Unlock');
    // Still open with the words; the locked beat is as it was sent.
    expect(editor().value).toBe('Lala: Changed while locking.');
    // The Raw editor waits for the open line (Raw editor audit, 2026-10-24: the toggle lost its words).
    fireEvent.click(screen.getByRole('button', { name: 'Raw editor' }));
    expect(screen.queryByRole('textbox', { name: 'Raw script' })).toBeNull();
    expect(editor().value).toBe('Lala: Changed while locking.');
    fireEvent.click(within(editor().closest('.esp-line-edit')).getByRole('button', { name: 'Cancel' }));
    expect(beat1Lines()).toEqual(['Lala: Hi besties.', 'Lala: Second line.']);
  });

  test('a line added while the lock is on its way is refused, and stays in the adder', async () => {
    const reply = deferred();
    vi.mocked(api.put).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(screen.getByTestId('script-add-line-1'));
    fireEvent.change(screen.getByTestId('script-line-adder-text'), { target: { value: 'Late words' } });
    fireEvent.click(screen.getByTestId('script-lock-1'));
    fireEvent.click(screen.getByTestId('script-line-adder-add'));
    expect(await screen.findByText('Wait for the lock to finish.')).toBeTruthy();
    expect(screen.getByTestId('script-line-adder-text').value).toBe('Late words');
    await act(async () => { reply.resolve({ data: { data: { script_locked_beats: [1] } } }); });
    expect(screen.getByTestId('script-beat-1').textContent).not.toContain('Late words');
  });
});

describe('Escape closes only the dialog on top', () => {
  test('History, then the DREAM Map: Escape closes the map, then History', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-history'));
    await screen.findByTestId('script-history-panel');
    fireEvent.click(await screen.findByTitle('Open DREAM Map'));
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'DREAM Map' })).toBeNull();
    expect(screen.getByTestId('script-history-panel')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('script-history-panel')).toBeNull());
  });

  test('the Context sheet, then History: Escape closes History, not the sheet', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-bar-context'));
    fireEvent.click(screen.getByTestId('script-history'));
    await screen.findByTestId('script-history-panel');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('script-history-panel')).toBeNull());
    expect(screen.getByTestId('script-context-close')).toBeTruthy();
  });

  test('Tab is not pulled back into History while the map is on top', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-history'));
    const panel = await screen.findByTestId('script-history-panel');
    fireEvent.click(await screen.findByTitle('Open DREAM Map'));
    const close = screen.getByRole('button', { name: 'Close map' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(panel.contains(document.activeElement)).toBe(false);
  });
});

test('a bar tap shows an adder already open, with its words', async () => {
  renderTab();
  fireEvent.click(screen.getByTestId('script-add-action-1'));
  fireEvent.change(screen.getByTestId('script-line-adder-text'), { target: { value: 'She spins' } });
  fireEvent.click(screen.getByTestId('script-bar-line'));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('script-line-adder-text')));
  expect(screen.getByTestId('script-line-adder-text').value).toBe('She spins');
});

describe('focus after Delete and Move', () => {
  test('Delete gives focus to the line now in its place', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties/));
    fireEvent.click(screen.getByTestId('script-line-delete'));
    await waitFor(() => expect(document.activeElement.getAttribute('data-testid')).toBe('script-line'));
    expect(document.activeElement.textContent).toContain('Second line.');
  });

  test('Move down gives focus to the moved line', async () => {
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties/));
    fireEvent.click(screen.getByRole('button', { name: 'Move line down' }));
    await waitFor(() => expect(document.activeElement.getAttribute('data-testid')).toBe('script-line'));
    expect(document.activeElement.textContent).toContain('Hi besties.');
    expect(document.activeElement.getAttribute('data-line-index')).toBe('1');
  });
});
