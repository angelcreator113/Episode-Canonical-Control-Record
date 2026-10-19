/**
 * Data safety on the Script page (Script page audit, 2026-10-19):
 * - a save, lock or Regenerate reports its own episode, and the episode page
 *   ignores a report for an episode it no longer holds;
 * - words typed in a line's editor never vanish: not when the beat is
 *   approved meanwhile, not when a line is added above it;
 * - History shows the version last asked for, and stays open when the page
 *   refuses the version;
 * - Ask for a change keeps its words when the request fails;
 * - the whole-script Regenerate waits for a lock or a save.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab, { nextLineIds } from './EpisodeScriptTab';
import { withSavedScript } from '../../pages/EpisodeDetail';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\nLala: Second line.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = (props = {}, id = 'ep-1') => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id, show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} {...props} /></MemoryRouter>,
);
const deferred = () => { let resolve; let reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
const raw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return screen.getByRole('textbox', { name: 'Raw script' }).value; };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  window.localStorage.clear();
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

describe('a save lands only on its own episode', () => {
  test('withSavedScript merges a report for the held episode, and ignores another', () => {
    const b = { id: 'ep-b', script_content: 'B', script_locked_beats: [] };
    expect(withSavedScript(b, { id: 'ep-a', script_content: 'A', script_locked_beats: [1] })).toBe(b);
    expect(withSavedScript(b, { id: 'ep-b', script_content: 'B2', script_locked_beats: [2] }))
      .toEqual({ id: 'ep-b', script_content: 'B2', script_locked_beats: [2] });
    expect(withSavedScript(null, { id: 'ep-b', script_content: 'B2' })).toBeNull();
  });

  test('a Regenerate for episode A that lands after the page moved to B leaves B as it is', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // The episode page's state, as EpisodeDetail keeps it.
    let page = { id: 'ep-a', script_content: SCRIPT, script_locked_beats: [] };
    const onSaved = (fields) => { page = withSavedScript(page, fields); };
    const view = renderTab({ onSaved }, 'ep-a');
    fireEvent.click(screen.getByTestId('script-regenerate'));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    // The page moves to episode B: the tab is keyed by the episode, so A's closes.
    view.unmount();
    page = { id: 'ep-b', script_content: 'B script', script_locked_beats: [3] };
    await act(async () => { reply.resolve({ data: { saved: true, script: '## BEAT: 1 · Opening Ritual\nLala: A only.' } }); });
    expect(page).toEqual({ id: 'ep-b', script_content: 'B script', script_locked_beats: [3] });
  });
});

describe('typed words are never lost', () => {
  test('a beat approved while its line is open keeps the editor and the words', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { script_locked_beats: [1] } } });
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties\./));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: My new words.' } });
    fireEvent.click(screen.getByTestId('script-lock-1'));
    await waitFor(() => expect(screen.getByTestId('script-lock-1').textContent).toBe('Unlock'));
    // Still open, with the words, and saying why.
    expect(screen.getByRole('textbox', { name: 'Edit line' }).value).toBe('Lala: My new words.');
    expect(screen.getByTestId('script-line-locked-note')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('textbox', { name: 'Edit line' }).closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/This beat is approved, so the line was not changed/)).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Edit line' }).value).toBe('Lala: My new words.');
  });

  test('a line added above an open line editor keeps the editor and its words', () => {
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Second line\./));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit line' }), { target: { value: 'Lala: Half typed' } });
    fireEvent.click(screen.getByTestId('script-add-line-1'));
    const adder = screen.getByTestId('script-line-adder');
    fireEvent.change(within(adder).getByTestId('script-line-adder-where'), { target: { value: '0' } });
    fireEvent.change(within(adder).getByTestId('script-line-adder-text'), { target: { value: 'Squeeze in' } });
    fireEvent.click(within(adder).getByTestId('script-line-adder-add'));
    expect(screen.getByTestId('script-beat-1').textContent).toContain('Squeeze in');
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    expect(box.value).toBe('Lala: Half typed');
    // Save puts the words on the line that was open, now one place down.
    fireEvent.click(within(box.closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));
    expect(raw()).toContain('Lala: Hi besties.\nLala: Squeeze in\nLala: Half typed\n');
  });

  test('nextLineIds keeps each line its id when a line is added above (re-audit: by id, not words)', () => {
    let n = 0;
    expect(nextLineIds(['a', 'b', 'a'], ['x', 'y', 'z'], ['new', 'a', 'b', 'a'], null, () => `n${++n}`)).toEqual(['n1', 'x', 'y', 'z']);
  });
});

describe('History', () => {
  const V1 = 'aaaaaaaa-0000-4000-8000-000000000001';
  const V2 = 'aaaaaaaa-0000-4000-8000-000000000002';
  const versions = [
    { id: V1, created_at: '2026-10-15T01:00:00Z', source: 'save', beats: 1, preview: 'one' },
    { id: V2, created_at: '2026-10-16T01:00:00Z', source: 'save', beats: 1, preview: 'two' },
  ];

  test('an earlier read that answers late is dropped', async () => {
    const first = deferred();
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/api/v1/episodes/ep-1/script-versions') return Promise.resolve({ data: { data: versions } });
      if (url.endsWith(V1)) return first.promise;
      if (url.endsWith(V2)) return Promise.resolve({ data: { data: { id: V2, source: 'save', beats: 1, script_content: 'Version two' } } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderTab();
    fireEvent.click(screen.getByTestId('script-history'));
    const items = await screen.findAllByTestId('script-history-item');
    fireEvent.click(items[0]);
    fireEvent.click(items[1]);
    expect((await screen.findByTestId('script-history-text')).textContent).toBe('Version two');
    await act(async () => { first.resolve({ data: { data: { id: V1, source: 'save', beats: 1, script_content: 'Version one' } } }); });
    expect(screen.getByTestId('script-history-text').textContent).toBe('Version two');
    fireEvent.click(screen.getByTestId('script-history-restore'));
    expect(raw()).toBe('Version two');
  });

  test('a refused restore leaves the panel open on the version', async () => {
    const gen = deferred();
    vi.mocked(api.post).mockReturnValue(gen.promise);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/api/v1/episodes/ep-1/script-versions') return Promise.resolve({ data: { data: versions } });
      if (url.endsWith(V2)) return Promise.resolve({ data: { data: { id: V2, source: 'save', beats: 1, script_content: 'Version two' } } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderTab();
    fireEvent.click(screen.getByTestId('script-regenerate'));
    expect(await screen.findByTestId('script-generating')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-history'));
    fireEvent.click((await screen.findAllByTestId('script-history-item'))[1]);
    await screen.findByTestId('script-history-text');
    fireEvent.click(screen.getByTestId('script-history-restore'));
    expect(await screen.findByText(/Wait for the new script before putting a version back/)).toBeTruthy();
    expect(screen.getByTestId('script-history-panel')).toBeTruthy();
    expect(screen.getByTestId('script-history-text').textContent).toBe('Version two');
    await act(async () => { gen.resolve({ data: { saved: true, script: SCRIPT } }); });
  });
});

describe('Ask for a change', () => {
  test('a failed request keeps the typed words', async () => {
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('boom'), { response: { data: { error: 'The writer is down' } } }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderTab();
    fireEvent.change(screen.getByTestId('script-ask-input-1'), { target: { value: 'punchier' } });
    fireEvent.click(screen.getByTestId('script-ask-send-1'));
    expect(await screen.findByText(/Regenerate failed: The writer is down/)).toBeTruthy();
    expect(screen.getByTestId('script-ask-input-1').value).toBe('punchier');
  });

  test('the words clear once a new version is back', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { beat: '## BEAT: 1 · Opening Ritual\nLala: Punchier.' } });
    renderTab();
    fireEvent.change(screen.getByTestId('script-ask-input-1'), { target: { value: 'punchier' } });
    fireEvent.click(screen.getByTestId('script-ask-send-1'));
    await screen.findByTestId('script-proposal');
    await waitFor(() => expect(screen.getByTestId('script-ask-input-1').value).toBe(''));
  });
});

describe('whole-script Regenerate', () => {
  test('waits while a lock is on its way', async () => {
    const lock = deferred();
    vi.mocked(api.put).mockReturnValue(lock.promise);
    renderTab();
    expect(screen.getByTestId('script-regenerate').disabled).toBe(false);
    fireEvent.click(screen.getByTestId('script-lock-1'));
    expect(screen.getByTestId('script-regenerate').disabled).toBe(true);
    await act(async () => { lock.resolve({ data: { data: { script_locked_beats: [1] } } }); });
    expect(screen.getByTestId('script-regenerate').disabled).toBe(false);
  });

  test('waits while a save is on its way', async () => {
    const save = deferred();
    vi.mocked(api.put).mockReturnValue(save.promise);
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties\./));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: Edited.' } });
    fireEvent.click(within(box.closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    expect(screen.getByTestId('script-regenerate').disabled).toBe(true);
    await act(async () => { save.resolve({ data: { data: {} } }); });
    expect(screen.getByTestId('script-regenerate').disabled).toBe(false);
  });
});
