/**
 * The Script tab's beat editing (Script tab audit 6, 2026-10-24):
 * 1 an open line editor's words stop a beat switch, and count for leaving;
 * 2 whole-script Regenerate waits for an open line and names unsaved edits;
 * 3 one AI suggestion at a time;
 * 4 a beat past 14 offers no Approve or Regenerate;
 * 5 "Complete" only with all 14 beats approved, once each;
 * 6 half-typed adder words outlive their beat closing, and still count;
 * 7 Approve waits for a Save on its way;
 * 8 a line edit stays one line, and is never a beat header;
 * 9 touch targets, the Rewrite button's name, the spinner, the new suggestion;
 * 10 the Voice tab's link; 11 the side tabs' arrow keys.
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
import EpisodeScriptTab, { oneLine, firstWords } from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\nLala: Second line.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.\n\n## BEAT: 3 · Welcome\nLala: Welcome.';
const ALL = Array.from({ length: 14 }, (_, i) => i + 1);
const FULL = ALL.map((n) => `## BEAT: ${n}\nLala: Beat ${n}.`).join('\n\n');
const renderTab = (script = SCRIPT, locks = [], props = {}) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: locks }} show={{ id: 'show-1' }} {...props} /></MemoryRouter>,
);
const deferred = () => { let r; const promise = new Promise((res) => { r = res; }); return { promise, resolve: r }; };
const toastText = () => screen.getAllByRole('status').map((n) => n.textContent).join(' ');
const saveLine = () => fireEvent.click(within(screen.getByRole('textbox', { name: 'Edit line' }).closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));
const openEditor = (text, words) => {
  fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(text));
  if (words !== undefined) fireEvent.change(screen.getByRole('textbox', { name: 'Edit line' }), { target: { value: words } });
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  window.localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

describe('1: an open line editor', () => {
  test('a pill, the beat list and the next arrow wait for it; its words stay', () => {
    renderTab();
    openEditor(/Hi besties/, 'Typed but not saved');
    fireEvent.click(screen.getByTestId('script-pill-2'));
    expect(toastText()).toContain("Save or cancel the line you're editing first");
    fireEvent.click(screen.getByTestId('script-nav-2'));
    fireEvent.click(screen.getByTestId('script-beat-next'));
    expect(screen.getByTestId('script-pill-1').getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Edit line' }).value).toBe('Typed but not saved');
    // Cancelled, the switch goes.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByTestId('script-pill-2'));
    expect(screen.getByTestId('script-pill-2').getAttribute('aria-current')).toBe('true');
  });

  test('counts for leaving (onDirtyChange, beforeunload), while the Save bar reads the script', () => {
    const onDirtyChange = vi.fn();
    const add = vi.spyOn(window, 'addEventListener');
    renderTab(SCRIPT, [], { onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    openEditor(/Hi besties/, 'Changed words');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true);
    expect(screen.queryByTestId('script-savebar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  test('Save still saves the line', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    renderTab();
    openEditor(/Hi besties/, 'Lala: Saved words.');
    saveLine();
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episodes/ep-1', expect.objectContaining({ script_content: expect.stringContaining('Lala: Saved words.') })));
  });
});

describe('2: whole-script Regenerate', () => {
  test('waits for an open line, and names unsaved edits in its ask', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab();
    openEditor(/Hi besties/, 'Half typed');
    fireEvent.click(screen.getByTestId('script-regenerate'));
    expect(confirm).not.toHaveBeenCalled();
    expect(toastText()).toContain("Save or cancel the line you're editing first");
    saveLine();
    fireEvent.click(screen.getByTestId('script-regenerate'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain('Your unsaved changes will be lost (History keeps the saved script, not these edits).');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('a saved script is asked about without the unsaved warning', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab();
    fireEvent.click(screen.getByTestId('script-regenerate'));
    expect(confirm.mock.calls[0][0]).not.toContain('unsaved');
  });
});

describe('3: one suggestion at a time', () => {
  test('while a rewrite is pending, Rewrite line, Regenerate beat and Ask wait, and say why', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { rewrittenLine: 'Hello besties.' } });
    renderTab();
    const beat = () => screen.getByTestId('script-beat-1');
    fireEvent.click(within(beat()).getAllByRole('button', { name: /^Rewrite line:/ })[0]);
    // The line's panel opens; its Rewrite asks (2026-10-25).
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    expect(await screen.findByTestId('script-proposal')).toBeTruthy();
    const rewrites = within(beat()).getAllByRole('button', { name: /^Rewrite line:/ });
    expect(rewrites.every((b) => b.disabled && b.title === 'Use or dismiss the suggestion first')).toBe(true);
    expect(screen.getByTestId('script-regen-beat-1').disabled).toBe(true);
    expect(screen.getByTestId('script-regen-beat-1').title).toBe('Use or dismiss the suggestion first');
    fireEvent.change(screen.getByTestId('script-ask-input-1'), { target: { value: 'punchier' } });
    expect(screen.getByTestId('script-ask-send-1').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('script-proposal-discard'));
    expect(within(beat()).getAllByRole('button', { name: /^Rewrite line:/ }).every((b) => !b.disabled)).toBe(true);
    expect(screen.getByTestId('script-regen-beat-1').disabled).toBe(false);
  });

  test('while a rewrite is on its way, the other lines wait too', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getAllByRole('button', { name: /^Rewrite line:/ })[0]);
    // The line's panel opens; its Rewrite asks (2026-10-25).
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    const other = within(screen.getByTestId('script-beat-1')).getByRole('button', { name: /^Rewrite line: Lala: Second/ });
    expect(other.disabled).toBe(true);
    expect(other.title).toBe('Wait for the suggestion being written');
    expect(screen.getByTestId('script-regen-beat-1').disabled).toBe(true);
    await act(async () => { reply.resolve({ data: { rewrittenLine: 'Hello besties.' } }); });
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});

describe('4: a beat past 14', () => {
  test('offers no Approve, Regenerate or Ask, and says why', () => {
    renderTab('## BEAT: 1 · Opening Ritual\nLala: Hi.\n\n## BEAT: 15 · Bonus\nLala: Extra.');
    fireEvent.click(screen.getByTestId('script-pill-15'));
    expect(screen.queryByTestId('script-lock-15')).toBeNull();
    expect(screen.queryByTestId('script-regen-beat-15')).toBeNull();
    expect(screen.queryByTestId('script-ask-15')).toBeNull();
    expect(screen.getByTestId('script-beat-canon-note-15').textContent).toContain('Only beats 1–14 can be approved');
    // Its row's ⋮ says so too.
    const row = screen.getByTestId('script-row-15');
    const menu = row.querySelector('details');
    menu.open = true; fireEvent(menu, new Event('toggle'));
    expect(within(row).queryByRole('button', { name: 'Approve & lock' })).toBeNull();
    expect(within(row).getByTestId('script-row-canon-note-15')).toBeTruthy();
  });
});

describe('5: approved means all 14, once each', () => {
  test('a few approved: "n of 14 approved", what is left, no Complete', () => {
    renderTab(SCRIPT, [1, 2]);
    expect(screen.getByTestId('script-approved').textContent).toBe('2 of 14 approved');
    expect(screen.getByTestId('script-approve-left').textContent).toContain('to approve: 3');
    expect(screen.getByTestId('script-beats-missing').textContent).toContain('not in the script: 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14');
    expect(screen.getByTestId('script-head').textContent).not.toContain('Complete');
    expect(screen.queryByText(/All beats approved/)).toBeNull();
  });

  test('every beat of a short script approved is not complete', () => {
    renderTab('## BEAT: 11 · Event\nLala: Hi.', [11]);
    expect(screen.getByTestId('script-approved').textContent).toBe('1 of 14 approved');
    expect(screen.queryByText(/All beats approved/)).toBeNull();
  });

  test('all 14 approved: Complete', () => {
    renderTab(FULL, ALL);
    expect(screen.getByTestId('script-approved').textContent).toBe('14 of 14 approved');
    expect(screen.getByTestId('script-head').textContent).toContain('Complete');
    expect(screen.getByText(/All beats approved — script is ready/)).toBeTruthy();
  });

  test('a second beat with the same number counts once, and says so', () => {
    const dup = FULL.replace('## BEAT: 14\nLala: Beat 14.', '## BEAT: 13\nLala: Again.');
    renderTab(dup, ALL);
    expect(screen.getByTestId('script-approved').textContent).toBe('13 of 14 approved');
    expect(screen.getByTestId('script-beats-missing').textContent).toContain('14');
    expect(screen.getByTestId('script-beat-duplicate-13').textContent).toBe('Second beat 13 · counts once');
    expect(screen.queryByText(/All beats approved/)).toBeNull();
  });
});

describe('6: half-typed adder words', () => {
  test('outlive their beat closing, and still stop the Raw editor and count for leaving', () => {
    const onDirtyChange = vi.fn();
    renderTab(SCRIPT, [], { onDirtyChange });
    fireEvent.click(screen.getByTestId('script-add-line-1'));
    fireEvent.change(screen.getByTestId('script-line-adder-text'), { target: { value: 'half a line' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    // Another beat: the adder closes with its beat, its words don't.
    fireEvent.click(screen.getByTestId('script-pill-2'));
    expect(screen.queryByTestId('script-line-adder-text')).toBeNull();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByTestId('script-raw-toggle'));
    expect(screen.queryByRole('textbox', { name: 'Raw script' })).toBeNull();
    expect(toastText()).toContain('Add or clear the words typed in beat 1 first');
    fireEvent.click(screen.getByTestId('script-pill-1'));
    expect(screen.getByTestId('script-line-adder-text').value).toBe('half a line');
    // Cleared, they no longer count.
    fireEvent.change(screen.getByTestId('script-line-adder-text'), { target: { value: '' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});

describe('7: Approve waits for a Save', () => {
  test('a lock is not sent while the save is on its way', async () => {
    const put = deferred();
    vi.mocked(api.put).mockReturnValue(put.promise);
    renderTab();
    openEditor(/Hi besties/, 'Lala: New.');
    saveLine();
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    const lock = screen.getByTestId('script-lock-1');
    expect(lock.getAttribute('aria-disabled')).toBe('true');
    expect(lock.title).toBe('Wait for the save to finish');
    fireEvent.click(lock);
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    await act(async () => { put.resolve({ data: { data: { script_content: SCRIPT.replace('Lala: Hi besties.', 'Lala: New.') } } }); });
    expect(screen.getByTestId('script-lock-1').getAttribute('aria-disabled')).toBeNull();
  });
});

describe('8: a line edit is one line', () => {
  test('line breaks become spaces', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    renderTab();
    openEditor(/Hi besties/, 'Lala: One\nand two');
    saveLine();
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const sent = vi.mocked(api.put).mock.calls[0][1].script_content;
    expect(sent).toContain('Lala: One and two');
    expect(screen.getAllByTestId(/^script-pill-/)).toHaveLength(3);
  });

  test('a typed beat header is refused, and the words stay', () => {
    renderTab();
    openEditor(/Hi besties/, 'Lala: Hi.\n## BEAT: 15 · Sneaky');
    saveLine();
    // Made one line, it isn't a header; typed alone, it is refused.
    expect(screen.getAllByTestId(/^script-pill-/)).toHaveLength(3);
    openEditor(/Second line/, '## BEAT: 15 · Sneaky');
    saveLine();
    expect(toastText()).toContain("A line can't start a new beat");
    expect(screen.getByRole('textbox', { name: 'Edit line' }).value).toBe('## BEAT: 15 · Sneaky');
    expect(screen.getAllByTestId(/^script-pill-/)).toHaveLength(3);
  });

  test('oneLine', () => {
    expect(oneLine('a\r\n\n  b c ')).toBe('a b c');
    expect(firstWords('Lala: one two three four five six seven')).toBe('Lala: one two three four five…');
  });
});

describe('9: touch targets and names', () => {
  const css = readFileSync(resolve(__dirname, 'EpisodeScriptPage.css'), 'utf8');
  test('the adder close and the icon-only moves are 44px; the spinner shows', () => {
    expect(css).toMatch(/\.esp-picker-close \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
    expect(css).toMatch(/\.esp-move-btn\.is-icon \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
    expect(css).toMatch(/\.esp-rewrite\.is-rewriting \{[^}]*opacity: 1;/);
    renderTab();
    openEditor(/Hi besties/);
    expect(screen.getByRole('button', { name: 'Move line up' }).className).toContain('is-icon');
  });

  test('each Rewrite names its line; the new suggestion is announced and focused', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { rewrittenLine: 'Hello besties.' } });
    renderTab();
    const btn = screen.getByRole('button', { name: 'Rewrite line: Lala: Hi besties.' });
    fireEvent.click(btn);
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    const card = await screen.findByTestId('script-proposal');
    await waitFor(() => expect(document.activeElement).toBe(card));
    expect(screen.getByTestId('script-proposal-live').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByTestId('script-proposal-live').textContent).toContain('The rewritten line is ready');
  });

  test('the rewriting line keeps its spinner class', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite line: Lala: Hi besties.' }));
    // The line's panel opens; its Rewrite asks (2026-10-25).
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    expect(screen.getByRole('button', { name: 'Rewriting…' }).className).toContain('is-rewriting');
    await act(async () => { reply.resolve({ data: { rewrittenLine: 'x' } }); });
  });
});

describe('10 and 11: the side panel', () => {
  test('Voice links the Character Registry', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-side-tab-voice'));
    const link = within(screen.getByTestId('script-voice')).getByText('Open Character Registry');
    expect(link.getAttribute('href')).toBe('/character-registry');
  });

  test('arrow keys move between the tabs; only the open one is tabbable', () => {
    renderTab();
    const tabs = within(screen.getByTestId('script-side-tabs')).getAllByRole('tab');
    const on = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    expect(tabs.filter((t) => t.tabIndex === 0)).toEqual([on]);
    on.focus();
    fireEvent.keyDown(on, { key: 'ArrowRight' });
    const now = within(screen.getByTestId('script-side-tabs')).getAllByRole('tab');
    const next = now[(now.findIndex((t) => t.id === on.id) + 1) % now.length];
    expect(next.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(next);
    fireEvent.keyDown(next, { key: 'Home' });
    expect(within(screen.getByTestId('script-side-tabs')).getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(document.activeElement, { key: 'End' });
    const last = within(screen.getByTestId('script-side-tabs')).getAllByRole('tab').at(-1);
    expect(last.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(last);
  });
});
