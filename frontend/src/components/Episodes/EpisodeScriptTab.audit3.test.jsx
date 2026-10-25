/**
 * Script page audit 3 (2026-10-19): nothing changes a beat while its lock
 * saves; an open line editor's words are never thrown away; a rewrite lands
 * on its own line, found by its id; Table read joins the dialog stack.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';
import ScriptHistory from './ScriptHistory';
import ScriptTableRead from './ScriptTableRead';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const OLD = '## BEAT: 1 · Opening Ritual\nLala: OLD WORDS.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = (script = SCRIPT) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const raw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return screen.getByRole('textbox', { name: 'Raw script' }).value; };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (/script-versions\/v1$/.test(url)) return { data: { data: { id: 'v1', source: 'save', script_content: OLD, beats: 2 } } };
    if (/script-versions$/.test(url)) return { data: { data: [{ id: 'v1', source: 'save', beats: 2 }] } };
    return { data: { data: [] } };
  });
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
});

describe('while a lock saves, nothing changes the script', () => {
  test('History does not put a version back', async () => {
    const lock = deferred();
    vi.mocked(api.put).mockReturnValue(lock.promise);
    renderTab();
    fireEvent.click(screen.getByTestId('script-lock-1'));
    fireEvent.click(screen.getByTestId('script-history'));
    fireEvent.click(await screen.findByTestId('script-history-item'));
    fireEvent.click(await screen.findByTestId('script-history-restore'));
    expect(screen.getByText('Wait for the lock to finish.')).toBeTruthy();
    expect(screen.getByTestId('script-history-panel')).toBeTruthy();
    await act(async () => { lock.resolve({ data: { data: { script_locked_beats: [1] } } }); });
    expect(screen.getByTestId('script-beat-1').textContent).not.toContain('OLD WORDS');
    expect(screen.queryByTestId('script-dirty')).toBeNull();
  });

  test('a beat does not move', async () => {
    const lock = deferred();
    vi.mocked(api.put).mockReturnValue(lock.promise);
    renderTab();
    fireEvent.click(screen.getByTestId('script-lock-1'));
    expect(screen.getByTestId('script-beat-down-1').disabled).toBe(true);
    await act(async () => { lock.resolve({ data: { data: { script_locked_beats: [1] } } }); });
    expect(screen.queryByTestId('script-dirty')).toBeNull();
  });

  test('the raw editor is read-only', () => {
    vi.mocked(api.put).mockReturnValue(deferred().promise);
    renderTab();
    fireEvent.click(screen.getByTestId('script-lock-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Raw editor' }));
    expect(screen.getByRole('textbox', { name: 'Raw script' }).readOnly).toBe(true);
  });

  test("Ready to film's fixes wait", () => {
    vi.mocked(api.put).mockReturnValue(deferred().promise);
    renderTab('## BEAT: 4 · Interruption Pulse 1\nMe: ooh\nLala: hi\n\n## BEAT: 5 · Reveal\n[UI:DISPLAY Start button]\nMe: read it');
    // Ready to film? starts folded (Script page audit 4, 2026-10-19).
    fireEvent.click(screen.getByTestId('script-health-toggle'));
    fireEvent.click(screen.getByTestId('script-lock-4'));
    expect(screen.getByTestId('script-health-fix-voice-beat-4').disabled).toBe(true);
  });

  test('Save and Ctrl/Cmd+S wait', () => {
    vi.mocked(api.put).mockReturnValue(deferred().promise);
    renderTab();
    const raw2 = () => { fireEvent.click(screen.getByRole('button', { name: /Raw editor|Beat view/ })); };
    raw2();
    fireEvent.change(screen.getByRole('textbox', { name: 'Raw script' }), { target: { value: `${SCRIPT}\nLala: More.` } });
    raw2();
    fireEvent.click(screen.getByTestId('script-lock-1'));
    expect(screen.getByTestId('script-savebar-save').disabled).toBe(true);
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(vi.mocked(api.put).mock.calls.filter(([url]) => url === '/api/v1/episodes/ep-1')).toHaveLength(0);
  });
});

describe('an open line editor keeps its words', () => {
  test('"Use it" on a new beat waits for the open line', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(screen.getByTestId('script-regen-beat-1'));
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties/));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit line' }), { target: { value: 'Lala: My typed words.' } });
    await act(async () => { reply.resolve({ data: { beat: '## BEAT: 1 · Opening Ritual\nLala: Fresh.' } }); });
    fireEvent.click(await screen.findByTestId('script-proposal-accept'));
    expect(screen.getByText("Save or cancel the line you're editing first.")).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Edit line' }).value).toBe('Lala: My typed words.');
    expect(screen.getByTestId('script-proposal')).toBeTruthy();
  });

  test('History waits for the open line', async () => {
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties/));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit line' }), { target: { value: 'Lala: My typed words.' } });
    fireEvent.click(screen.getByTestId('script-history'));
    fireEvent.click(await screen.findByTestId('script-history-item'));
    fireEvent.click(await screen.findByTestId('script-history-restore'));
    expect(screen.getByText("Save or cancel the line you're editing first.")).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Edit line' }).value).toBe('Lala: My typed words.');
  });

  test('an open line not changed does not hold "Use it" up', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(screen.getByTestId('script-regen-beat-1'));
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties/));
    await act(async () => { reply.resolve({ data: { beat: '## BEAT: 1 · Opening Ritual\nLala: Fresh.' } }); });
    fireEvent.click(await screen.findByTestId('script-proposal-accept'));
    expect(raw()).toContain('Lala: Fresh.');
  });
});

describe('a rewrite keeps to its own line', () => {
  const DUP = '## BEAT: 1 · Opening Ritual\nLala: Okay.\nLala: Middle.\nLala: Okay.';
  test('the second of two same lines is rewritten, after a line above it was deleted', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTab(DUP);
    const beat = screen.getByTestId('script-beat-1');
    fireEvent.click(within(beat).getAllByRole('button', { name: /^Rewrite line:/ })[2]);
    // The line's panel opens; its Rewrite asks (2026-10-25).
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    fireEvent.click(within(beat).getByText(/Middle/));
    fireEvent.click(screen.getByTestId('script-line-delete'));
    // The spinner stays on the line being rewritten, now the second row.
    const rewrites = within(screen.getByTestId('script-beat-1')).getAllByRole('button', { name: /Rewrit/ });
    expect(rewrites.map((b) => b.getAttribute('aria-label') === 'Rewriting…')).toEqual([false, true]);
    await act(async () => { reply.resolve({ data: { rewrittenLine: 'Fine then.' } }); });
    fireEvent.click(await screen.findByTestId('script-proposal-accept'));
    expect(raw()).toBe('## BEAT: 1 · Opening Ritual\nLala: Okay.\nLala: Fine then.');
  });
});

describe('Table read is a dialog on the stack', () => {
  test("Tab inside Table read over History stays in Table read", async () => {
    render(<ScriptHistory episodeId="ep-1" onRestore={() => true} />);
    fireEvent.click(screen.getByTestId('script-history'));
    await screen.findByTestId('script-history-item');
    const { unmount } = render(<ScriptTableRead scriptText={SCRIPT} onClose={() => {}} />);
    const larger = screen.getByRole('button', { name: 'Larger text' });
    larger.focus();
    fireEvent.keyDown(larger, { key: 'Tab' });
    expect(screen.getByTestId('script-history-panel').contains(document.activeElement)).toBe(false);
    unmount();
  });
});

describe('focus after a line is saved', () => {
  const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));
  const row = () => screen.getByTestId('script-beat-1').querySelector('[data-line-index="0"]');
  test('Save on a changed line: focus is on its row', async () => {
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties/));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: Hello loves.' } });
    fireEvent.click(within(box.closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));
    // Focused as the new rows land, not by a timer racing their remount.
    expect(document.activeElement).toBe(row());
    await settle();
    expect(document.activeElement).toBe(row());
    expect(row().textContent).toContain('Hello loves.');
  });
  test('Ctrl+Enter on a changed line: focus is on its row', async () => {
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties/));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: Hello loves.' } });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    expect(document.activeElement).toBe(row());
    await settle();
    expect(document.activeElement).toBe(row());
  });
  test('Cancel: focus is on the row', async () => {
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties/));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(document.activeElement).toBe(row());
  });
});
