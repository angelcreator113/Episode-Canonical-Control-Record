/**
 * The Script tab's Raw editor (Raw editor audit, 2026-10-24):
 * - R4 a cleared script, saved, keeps History and the toggle;
 * - R5 the toggle waits for words typed in a beat (Ask, Add line);
 * - R6 an approved beat changed here is marked in Beat view, and Table read
 *   reads its approved words;
 * - R7 the locked note follows the locks, not the parsed beats;
 * - R8 16px at phone width (iOS zoom);
 * - R9 `**Me:** words` is dialogue and `---` is nothing, everywhere, while
 *   a plain script's voice-clip line indexes don't move;
 * - R10 True now and Checks wait for Beat view;
 * - R11 the editor's place is kept across the toggle, and it opens at the
 *   open beat's header;
 * - R12 no spellcheck or autocorrect; the toggle is aria-pressed;
 * - the beats are parsed after a pause in typing, Save sends the latest text;
 * - a key pressed while a lock saves says why nothing happens.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab, { parseScriptIntoBeats, beatHeaderOffset } from './EpisodeScriptTab';
import { speakerLine, unbold, isRuleLine } from '../../lib/scriptSpeaker';
import { readLine, scriptSections, toPlainText } from '../../lib/scriptExport';
import { teleprompterIndexMap, teleprompterLines } from '../../lib/teleprompterLines';
import { lineSeconds } from '../../lib/scriptRuntime';
import { keepLockedBeats, editedLockedBeats } from '../../lib/scriptLocks';
import { lineDiff, diffHunks } from '../../lib/scriptLineDiff';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.\n\n## BEAT: 3 · Welcome\nLala: Welcome.';
const renderTab = (script = SCRIPT, locks = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: locks }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const rawBox = () => screen.getByRole('textbox', { name: 'Raw script' });
const toggle = () => screen.getByTestId('script-raw-toggle');
const deferred = () => { let r; const promise = new Promise((res) => { r = res; }); return { promise, resolve: r }; };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  window.localStorage.clear();
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); window.localStorage.clear(); });

describe('R4: a cleared script, saved', () => {
  test('keeps History and the toggle', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    renderTab();
    fireEvent.click(toggle());
    fireEvent.change(rawBox(), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('script-savebar')).toBeNull());
    expect(screen.getByTestId('script-history')).toBeTruthy();
    expect(toggle().textContent).toBe('Beat view');
    expect(screen.getByRole('button', { name: 'Generate Script' })).toBeTruthy();
    fireEvent.click(toggle());
    expect(screen.getByTestId('script-history')).toBeTruthy();
    expect(screen.getByTestId('script-empty')).toBeTruthy();
  });
});

describe('R5: the toggle waits for typed words', () => {
  test('in Ask for a change', () => {
    renderTab();
    fireEvent.change(screen.getByTestId('script-ask-input-1'), { target: { value: 'punchier' } });
    fireEvent.click(toggle());
    expect(screen.queryByRole('textbox', { name: 'Raw script' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Add or clear the words typed in the beat first');
    expect(screen.getByTestId('script-ask-input-1').value).toBe('punchier');
    fireEvent.change(screen.getByTestId('script-ask-input-1'), { target: { value: '' } });
    fireEvent.click(toggle());
    expect(rawBox()).toBeTruthy();
  });

  test('in Add line', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-add-line-1'));
    fireEvent.change(screen.getByTestId('script-line-adder-text'), { target: { value: 'half a line' } });
    fireEvent.click(toggle());
    expect(screen.queryByRole('textbox', { name: 'Raw script' })).toBeNull();
    expect(screen.getByTestId('script-line-adder-text').value).toBe('half a line');
  });
});

describe('R6 and R7: an approved beat changed in the Raw editor', () => {
  test('is marked in Beat view, and Table read reads the approved words', async () => {
    renderTab(SCRIPT, [1]);
    fireEvent.click(toggle());
    fireEvent.change(rawBox(), { target: { value: SCRIPT.replace('Hi besties.', 'Changed words.') } });
    expect(screen.getByTestId('script-raw-locked-note').textContent).toContain('Changed here: beat 1');
    fireEvent.click(toggle());
    expect(screen.getByTestId('script-beat-lock-edited-1').textContent).toBe('Edited · will be put back on save');
    expect(screen.getByTestId('script-beat-lock-edited-note-1')).toBeTruthy();
    expect(screen.queryByTestId('script-beat-lock-edited-2')).toBeNull();
    fireEvent.click(screen.getByTestId('script-table-read'));
    const read = await screen.findByTestId('table-read');
    expect(read.textContent).toContain('Hi besties.');
    expect(read.textContent).not.toContain('Changed words.');
  });

  test('the locked note shows when a locked header is renamed out of its number', () => {
    renderTab(SCRIPT, [1]);
    fireEvent.click(toggle());
    fireEvent.change(rawBox(), { target: { value: SCRIPT.replace('## BEAT: 1 · Opening Ritual', '## BEAT: Something else') } });
    expect(screen.getByTestId('script-raw-locked-note')).toBeTruthy();
  });

  test('keepLockedBeats puts an approved beat back, once, also under a renamed header', () => {
    expect(keepLockedBeats(SCRIPT.replace('Hi besties.', 'X.'), SCRIPT, [1]).script).toBe(SCRIPT);
    const renamed = SCRIPT.replace('## BEAT: 1 · Opening Ritual', '## BEAT: 15 · Renamed');
    const kept = keepLockedBeats(renamed, SCRIPT, [1]);
    expect(kept.script).toBe(SCRIPT);
    expect(kept.script.match(/Hi besties/g)).toHaveLength(1);
    expect(keepLockedBeats(SCRIPT, SCRIPT, [1])).toEqual({ script: SCRIPT, kept: [1], changed: [] });
    expect([...editedLockedBeats(SCRIPT.replace('Hi besties.', 'X.'), SCRIPT, [1, 2])]).toEqual(['beat-1']);
    // Re-spacing is not an edit.
    expect(editedLockedBeats(SCRIPT.replace('\n\n## BEAT: 2', '\n\n\n## BEAT: 2'), SCRIPT, [1]).size).toBe(0);
  });
});

describe('R8: iOS zoom', () => {
  test('the Raw editor is 16px at phone width', () => {
    const css = readFileSync(resolve(__dirname, 'EpisodeScriptPage.css'), 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width: 760px) {\n  .esp.has-beatlist'));
    expect(phone).toMatch(/\.esp-raw \{ font-size: 16px; \}/);
  });
});

describe('R9: bold speakers and rules', () => {
  test('one rule for the tab, the export, the runtime and the teleprompter', () => {
    expect(unbold('**Me:** Hello.')).toBe('Me: Hello.');
    expect(speakerLine('**Me:** Hello.')).toMatchObject({ speaker: 'Prime', words: 'Hello.', prefix: '**Me:** ' });
    expect(speakerLine('**Lala**: Hi.')).toMatchObject({ speaker: 'Lala', words: 'Hi.' });
    expect(speakerLine('__Kelli__: Yo.')).toMatchObject({ speaker: 'Kelli' });
    expect(readLine('**Lala**: Hi.')).toMatchObject({ type: 'dialogue', speaker: 'Lala', text: 'Hi.' });
    expect(isRuleLine('---')).toBe(true);
    expect(isRuleLine('  ***  ')).toBe(true);
    expect(isRuleLine('- - -')).toBe(true);
    expect(isRuleLine('___')).toBe(true);
    expect(isRuleLine('-- not a rule')).toBe(false);
    expect(isRuleLine('--')).toBe(false);
    expect(readLine('---')).toBeNull();
    expect(lineSeconds('---')).toBe(0);
    expect(toPlainText('## BEAT: 1 · Opening Ritual\n**Lala**: Hi.\n---').split('\n').filter((l) => l === '---')).toEqual([]);
    expect(toPlainText('## BEAT: 1 · Opening Ritual\n**Lala**: Hi.')).toContain('LALA\n  Hi.');
    expect(scriptSections('## BEAT: 1\n---\nLala: a').beats[0].lines).toEqual(['---', 'Lala: a']);
  });

  test('a plain script keeps its voice-clip line indexes', () => {
    const lines = ['Lala: one', '(she sits)', '[UI:OPEN Closet]', 'Me: two', '[WEAR: p1]', 'narration here', 'Kelli (V.O.): three'];
    expect(teleprompterIndexMap(lines)).toEqual([0, 1, null, 2, null, 3, 4]);
    expect(teleprompterLines(lines).map((l) => l.kind)).toEqual(['cue', 'direction', 'mine', 'direction', 'cue']);
    // The Script tab's beat lines keep every line, a rule included, so line places don't move.
    const beats = parseScriptIntoBeats('## BEAT: 1 · Opening Ritual\nLala: a\n---\n**Me:** b');
    expect(beats[0].lines).toEqual(['Lala: a', '---', '**Me:** b']);
  });

  test('the tab shows **Me:** as Prime\'s line and hides ---', () => {
    renderTab('## BEAT: 1 · Opening Ritual\n**Me:** Hello.\n---\nLala: Hi.');
    const beat = screen.getByTestId('script-beat-1');
    expect(within(beat).getAllByTestId('script-line')).toHaveLength(2);
    expect(beat.querySelector('.esp-line-speaker').textContent).toBe('Prime');
    expect(beat.textContent).not.toContain('---');
  });
});

describe('R10: beat panels in the Raw editor', () => {
  test('True now and Checks wait for Beat view', () => {
    renderTab();
    expect(screen.getByTestId('script-side-tab-truth')).toBeTruthy();
    fireEvent.click(toggle());
    expect(screen.queryByTestId('script-side-tab-truth')).toBeNull();
    expect(screen.queryByTestId('script-side-tab-checks')).toBeNull();
    fireEvent.click(toggle());
    expect(screen.getByTestId('script-side-tab-truth')).toBeTruthy();
  });
});

describe('R11 and R12: the editor itself', () => {
  test('keeps its place across the toggle, and opens at the open beat\'s header', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-pill-3'));
    fireEvent.click(toggle());
    const at = beatHeaderOffset(SCRIPT, 2);
    expect(at.line).toBe(6);
    expect(rawBox().selectionStart).toBe(SCRIPT.indexOf('## BEAT: 3'));
    rawBox().setSelectionRange(5, 9);
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(rawBox().selectionStart).toBe(5);
    expect(rawBox().selectionEnd).toBe(9);
  });

  test('no spellcheck or autocorrect; the toggle says whether it is on', () => {
    renderTab();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    const box = rawBox();
    expect(box.getAttribute('spellcheck')).toBe('false');
    expect(box.getAttribute('autocorrect')).toBe('off');
    expect(box.getAttribute('autocapitalize')).toBe('off');
  });

  test('the beats are parsed after a pause; Save sends the latest text', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    renderTab();
    fireEvent.click(toggle());
    const next = `${SCRIPT}\n\n## BEAT: 4 · Interruption Pulse 1\nLala: Ping.`;
    fireEvent.change(rawBox(), { target: { value: next } });
    expect(screen.getByTestId('script-head').textContent).toContain('3 beats');
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).toBe(next);
    await waitFor(() => expect(screen.getByTestId('script-head').textContent).toContain('4 beats'));
  });

  test('a key or Ctrl+S while a lock saves says why nothing happens', async () => {
    const reply = deferred();
    vi.mocked(api.put).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(screen.getByTestId('script-lock-1'));
    fireEvent.click(toggle());
    expect(rawBox().readOnly).toBe(true);
    fireEvent.keyDown(rawBox(), { key: 'a' });
    expect(screen.getByTestId('script-raw-wait').textContent).toBe('Saving the lock… one moment.');
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(screen.getAllByText('Saving the lock… one moment.').length).toBeGreaterThanOrEqual(2);
    await act(async () => { reply.resolve({ data: { data: { script_locked_beats: [1] } } }); });
    expect(screen.queryByTestId('script-raw-wait')).toBeNull();
  });
});

describe('lineDiff', () => {
  test('lines kept, in and out, and hunks with a gap', () => {
    const d = lineDiff('a\nb\nc\nd\ne\nf', 'a\nB\nc\nd\ne\nf\ng');
    expect(d.filter((x) => x.type !== 'same')).toEqual([{ type: 'del', text: 'b' }, { type: 'add', text: 'B' }, { type: 'add', text: 'g' }]);
    expect(diffHunks(d).map((x) => x.type)).toEqual(['same', 'del', 'add', 'same', 'gap', 'same', 'add']);
  });
});
