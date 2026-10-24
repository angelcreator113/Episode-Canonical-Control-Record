/**
 * What was saved stays saved, and unsaved work is not lost (Script tab
 * re-audit, 2026-10-15):
 * - a save that lands after the tab closed still reaches the episode page,
 *   and the tab reads the saved script as it opens;
 * - a link out of the tab asks first while there are unsaved changes;
 * - "Use it" does not write over a beat edited meanwhile, and a new script
 *   clears a waiting suggestion;
 * - Ctrl/Cmd+S in an open line saves that line too;
 * - a cleared script keeps Save; a line saved unchanged is not a change;
 * - the last edits are kept in the browser when the tab closes.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = (props = {}, script = SCRIPT) => render(
  <MemoryRouter>
    <EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} {...props} />
    <a href="/elsewhere" data-testid="out">Elsewhere</a>
  </MemoryRouter>,
);
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const openRaw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return screen.getByRole('textbox', { name: 'Raw script' }); };
const typeRaw = (text) => fireEvent.change(openRaw(), { target: { value: text } });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
});
afterEach(() => vi.restoreAllMocks());

describe('saved work reaches the episode page', () => {
  test('a save that lands after the tab closed is reported', async () => {
    const reply = deferred();
    vi.mocked(api.put).mockReturnValue(reply.promise);
    const onSaved = vi.fn();
    const view = renderTab({ onSaved });
    typeRaw(`${SCRIPT}\nLala: One more.`);
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    view.unmount();
    await act(async () => { reply.resolve({ data: { data: { script_content: `${SCRIPT}\nLala: One more.` } } }); });
    expect(onSaved).toHaveBeenCalledWith({ id: 'ep-1', script_content: `${SCRIPT}\nLala: One more.`, script_locked_beats: [] });
  });

  test('the tab reads the saved script as it opens', async () => {
    const NEW = '## BEAT: 1 · Opening Ritual\nLala: Written after you left.';
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/episodes/ep-1'
      ? { data: { data: { script_content: NEW, script_locked_beats: [1] } } }
      : { data: { data: [] } }));
    const onSaved = vi.fn();
    renderTab({ onSaved });
    await waitFor(() => expect(screen.getByTestId('script-beat-1').textContent).toContain('Written after you left.'));
    expect(onSaved).toHaveBeenCalledWith({ id: 'ep-1', script_content: NEW, script_locked_beats: [1] });
    expect(screen.queryByTestId('script-savebar')).toBeNull();
  });
});

describe('leaving with unsaved changes', () => {
  test('a link out of the tab asks first, and No stays', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab();
    expect(fireEvent.click(screen.getByTestId('out'))).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    typeRaw(`${SCRIPT}\nLala: Unsaved.`);
    expect(fireEvent.click(screen.getByTestId('out'))).toBe(false);
    expect(confirm).toHaveBeenCalledWith('You have unsaved script changes. Leave without saving?');
  });

  test('the last edits are kept in this browser when the tab closes', () => {
    const view = renderTab();
    typeRaw(`${SCRIPT}\nLala: Typed just now.`);
    view.unmount();
    expect(JSON.parse(window.localStorage.getItem('esp-draft-ep-1')).text).toContain('Typed just now.');
  });
});

describe('suggestions', () => {
  test('"Use it" does not write over a beat edited while it was written', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(screen.getByTestId('script-regen-beat-1'));
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties\./));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: My own opening.' } });
    fireEvent.click(within(box.closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));
    await act(async () => { reply.resolve({ data: { beat: '## BEAT: 1 · Opening Ritual\nLala: Fresh opening.' } }); });
    fireEvent.click(await screen.findByTestId('script-proposal-accept'));
    expect(await screen.findByText(/changed while it was being written, so your version stays/)).toBeTruthy();
    expect(openRaw().value).toContain('Lala: My own opening.');
  });

  test('a new script clears a waiting suggestion', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => (url.endsWith('/regenerate-beat')
      ? { data: { beat: '## BEAT: 1 · Opening Ritual\nLala: Fresh opening.' } }
      : new Promise(() => {})));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTab();
    fireEvent.click(screen.getByTestId('script-regen-beat-1'));
    expect(await screen.findByTestId('script-proposal-accept')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-regenerate'));
    await waitFor(() => expect(screen.queryByTestId('script-proposal-accept')).toBeNull());
  });
});

describe('saving', () => {
  test('Ctrl/Cmd+S in an open line saves that line too', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties\./));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: Saved with the keys.' } });
    fireEvent.keyDown(box, { key: 's', ctrlKey: true });
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).toContain('Lala: Saved with the keys.');
  });

  test('a cleared script keeps Save, and a line saved unchanged is not a change', () => {
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties\./));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.click(within(box.closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));
    expect(screen.queryByTestId('script-savebar')).toBeNull();
    typeRaw('');
    expect(screen.getByTestId('script-savebar-save')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Beat view' })).toBeTruthy();
  });
});

// Re-audit 2 (2026-10-15).
describe('after the tab opened', () => {
  test('a newer script the page gets is shown while nothing was edited', async () => {
    const NEW = '## BEAT: 1 · Opening Ritual\nLala: Landed after you came back.';
    const view = renderTab();
    view.rerender(
      <MemoryRouter>
        <EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: NEW, script_locked_beats: [] }} show={{ id: 'show-1' }} />
        <a href="/elsewhere" data-testid="out">Elsewhere</a>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('script-beat-1').textContent).toContain('Landed after you came back.'));
    expect(screen.queryByTestId('script-savebar')).toBeNull();
  });

  test('a script without headers: "Use it" works after another beat is edited', async () => {
    const plain = Array.from({ length: 14 }, (_, i) => `Lala: line ${i + 1}`).join('\n');
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    renderTab({}, plain);
    fireEvent.click(screen.getByTestId('script-beat-5').querySelector('.esp-beat-head'));
    fireEvent.click(screen.getByTestId('script-regen-beat-5'));
    fireEvent.click(screen.getByTestId('script-beat-2').querySelector('.esp-beat-head'));
    fireEvent.click(within(screen.getByTestId('script-beat-2')).getByText('"line 2"'));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: line two, edited' } });
    fireEvent.click(within(box.closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));
    await act(async () => { reply.resolve({ data: { beat: '## BEAT: 5 · Reveal\nLala: a fresh reveal' } }); });
    fireEvent.click(screen.getByTestId('script-beat-5').querySelector('.esp-beat-head'));
    fireEvent.click(await screen.findByTestId('script-proposal-accept'));
    const text = openRaw().value;
    expect(text).toContain('a fresh reveal');
    expect(text).toContain('line two, edited');
  });

  test('a kept draft asks before replacing a newer saved script', async () => {
    window.localStorage.setItem('esp-draft-ep-1', JSON.stringify({ text: `${SCRIPT}\nLala: kept`, base: SCRIPT, at: Date.now() }));
    const NEW = '## BEAT: 1 · Opening Ritual\nLala: Newer saved script.';
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/episodes/ep-1'
      ? { data: { data: { script_content: NEW, script_locked_beats: [] } } } : { data: { data: [] } }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('script-beat-1').textContent).toContain('Newer saved script.'));
    expect(screen.getByTestId('script-draft').textContent).toContain('The saved script has changed since.');
    fireEvent.click(screen.getByTestId('script-draft-restore'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('script-beat-1').textContent).toContain('Newer saved script.');
  });

  test('Ctrl/Cmd+S in a line while a save runs saves the line once that save ends', async () => {
    const first = deferred();
    vi.mocked(api.put).mockReturnValueOnce(first.promise).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    renderTab();
    typeRaw(`${SCRIPT}\nLala: B.`);
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    fireEvent.click(screen.getByRole('button', { name: 'Beat view' }));
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties\./));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: second save.' } });
    fireEvent.keyDown(box, { key: 's', ctrlKey: true });
    await act(async () => { first.resolve({ data: { data: { script_content: `${SCRIPT}\nLala: B.` } } }); });
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.put).mock.calls[1][1].script_content).toContain('Lala: second save.');
  });

  test('a rewrite that lands during a new script is not kept', async () => {
    const rewrite = deferred();
    vi.mocked(api.post).mockImplementation((url) => (url.endsWith('/rewrite-line') ? rewrite.promise : new Promise(() => {})));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByRole('button', { name: /^Rewrite line:/ }));
    fireEvent.click(screen.getByTestId('script-regenerate'));
    await act(async () => { rewrite.resolve({ data: { rewrittenLine: 'Hey, gorgeous.' } }); });
    expect(await screen.findByText(/A new script was written while the line was being rewritten/)).toBeTruthy();
    expect(screen.queryByTestId('script-proposal-accept')).toBeNull();
  });
});

