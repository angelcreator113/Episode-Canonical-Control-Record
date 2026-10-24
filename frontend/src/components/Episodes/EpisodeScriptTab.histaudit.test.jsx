/**
 * The Script tab's History (History audit, 2026-10-24):
 * - H3 a newer script saved while the page has edits is the page's base:
 *   the page stays unsaved against it, Approve sends the page's text, and a
 *   banner offers View newer, Keep mine and Use newer;
 * - H4 a version goes on the page with the approved beats as they are now;
 * - H5 an open suggestion is asked about before a version replaces it;
 * - H7 the next Save names the version (restored_from); 'restore' snapshots
 *   have their own label;
 * - H8 lines in and out of the page, a version the same as the page is not
 *   put back, "1 beat", the list read again on reopening, Try again;
 * - H9 Escape on a version goes back to the list, focus to its heading and
 *   back to its row; "Reading…" is polite;
 * - H13 a backdrop closes it; History pressed again keeps the version;
 * - dates read relative, with the full time on hover, and may be missing;
 * - a save naming moved approved beats says so.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';
import { versionTime, plural } from './ScriptHistory';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const OLD = '## BEAT: 1 · Opening Ritual\nLala: The first draft.\n\n## BEAT: 2 · Login Sequence\nLala: Old login.';
const VID = '3f2a9c1e-0000-4000-8000-000000000001';
const VID2 = '3f2a9c1e-0000-4000-8000-000000000002';
const episode = (script = SCRIPT, locks = []) => ({ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: locks });
const tree = (ep) => <MemoryRouter><EpisodeScriptTab episode={ep} show={{ id: 'show-1' }} /></MemoryRouter>;
const renderTab = (script = SCRIPT, locks = []) => render(tree(episode(script, locks)));
const rawText = () => screen.getByRole('textbox', { name: 'Raw script' }).value;
const openRaw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return rawText(); };
const typeRaw = (value) => {
  if (!screen.queryByRole('textbox', { name: 'Raw script' })) fireEvent.click(screen.getByRole('button', { name: 'Raw editor' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Raw script' }), { target: { value } });
};

let versions;
let version;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  window.localStorage.clear();
  versions = [{ id: VID, created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), source: 'generate', beats: 2, preview: 'Lala: The first draft.' }];
  version = { id: VID, created_at: versions[0].created_at, source: 'generate', beats: 2, script_content: OLD };
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episodes/ep-1/script-versions') return { data: { data: versions } };
    if (url.startsWith('/api/v1/episodes/ep-1/script-versions/')) return { data: { data: version } };
    return { data: { data: [] } };
  });
});
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

const openVersion = async () => {
  fireEvent.click(screen.getByTestId('script-history'));
  fireEvent.click(await screen.findByTestId('script-history-item'));
  return screen.findByTestId('script-history-version-head');
};

describe('H3: a newer script while the page has edits', () => {
  const NEWER = '## BEAT: 1 · Opening Ritual\nLala: Newer from elsewhere.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
  const EDIT = `${SCRIPT}\nLala: My edit.`;
  const landNewer = (view) => view.rerender(tree(episode(NEWER)));

  test('is the base: typing the edits back out is still unsaved, and the banner says so', async () => {
    const view = renderTab();
    typeRaw(EDIT);
    landNewer(view);
    expect(await screen.findByTestId('script-newer')).toBeTruthy();
    expect(rawText()).toBe(EDIT);
    // Back to the older text: not "Saved", since the server holds the newer one.
    typeRaw(SCRIPT);
    expect(screen.getByTestId('script-dirty')).toBeTruthy();
    expect(screen.queryByTestId('script-saved')).toBeNull();
  });

  test('Approve then sends the page text, not a lock on the newer one alone', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_locked_beats: body.locked_beats, script_content: body.script_content } } }));
    const view = renderTab();
    typeRaw(EDIT);
    landNewer(view);
    await screen.findByTestId('script-newer');
    typeRaw(SCRIPT);
    fireEvent.click(screen.getByRole('button', { name: 'Beat view' }));
    fireEvent.click(screen.getByTestId('script-lock-1'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/episodes/ep-1/script-locks');
    expect(body.script_content).toBe(SCRIPT);
  });

  test('View newer shows it read-only; Keep mine keeps the page; Use newer asks, then replaces', async () => {
    const view = renderTab();
    typeRaw(EDIT);
    landNewer(view);
    fireEvent.click(await screen.findByTestId('script-newer-view'));
    expect(screen.getByTestId('script-newer-script').textContent).toBe(NEWER);
    expect(screen.getByTestId('script-newer-view').getAttribute('aria-expanded')).toBe('true');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByTestId('script-newer-use'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(rawText()).toBe(EDIT);
    fireEvent.click(screen.getByTestId('script-newer-use'));
    expect(rawText()).toBe(NEWER);
    expect(screen.queryByTestId('script-newer')).toBeNull();
    expect(screen.queryByTestId('script-dirty')).toBeNull();
  });

  test('Keep mine closes the banner and the next Save writes the page', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    const view = renderTab();
    typeRaw(EDIT);
    landNewer(view);
    fireEvent.click(await screen.findByTestId('script-newer-keep'));
    expect(screen.queryByTestId('script-newer')).toBeNull();
    expect(rawText()).toBe(EDIT);
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).toBe(EDIT);
  });

  test('a newer script read on opening, over edits made meanwhile, asks too', async () => {
    let answer;
    vi.mocked(api.get).mockImplementation((url) => (url === '/api/v1/episodes/ep-1'
      ? new Promise((r) => { answer = r; }) : Promise.resolve({ data: { data: [] } })));
    renderTab();
    typeRaw(EDIT);
    await act(async () => { answer({ data: { data: { script_content: NEWER, script_locked_beats: [] } } }); });
    expect(screen.getByTestId('script-newer')).toBeTruthy();
    expect(rawText()).toBe(EDIT);
  });
});

describe('H4: approved beats stay as they are now', () => {
  test('a version goes on the page with beat 1 as approved, and says so', async () => {
    renderTab(SCRIPT, [1]);
    await openVersion();
    // The diff is of what lands: beat 1's words are not changed.
    const diff = screen.getByTestId('script-history-diff');
    expect(diff.textContent).toContain('Old login.');
    expect(diff.textContent).not.toContain('The first draft.');
    fireEvent.click(screen.getByTestId('script-history-restore'));
    expect(screen.getByRole('status').textContent).toContain('Approved beat 1 stays as it is now');
    const text = openRaw();
    expect(text).toContain('Lala: Hi besties.');
    expect(text).toContain('Lala: Old login.');
    expect(text).not.toContain('The first draft.');
  });
});

describe('H5: an open suggestion', () => {
  test('is asked about before a version replaces it', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { beat: '## BEAT: 2 · Login Sequence\nLala: Fresh login.' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab();
    fireEvent.click(screen.getByTestId('script-beat-2').querySelector('.esp-beat-head'));
    fireEvent.click(screen.getByTestId('script-regen-beat-2'));
    await screen.findByTestId('script-proposal');
    await openVersion();
    fireEvent.click(screen.getByTestId('script-history-restore'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain('suggestion');
    expect(screen.getByTestId('script-history-panel')).toBeTruthy();
    expect(screen.getByTestId('script-proposal')).toBeTruthy();
  });
});

describe('H7: the next Save names the version', () => {
  test('restored_from goes with the save, once', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    renderTab();
    await openVersion();
    fireEvent.click(screen.getByTestId('script-history-restore'));
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0][1]).toEqual({ script_content: OLD, restored_from: VID });
    typeRaw(`${OLD}\nLala: more.`);
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.put).mock.calls[1][1].restored_from).toBeUndefined();
  });

  test('a restore snapshot has its own label', async () => {
    versions = [{ id: VID2, created_at: null, source: 'restore', beats: 1, preview: 'x' }];
    renderTab();
    fireEvent.click(screen.getByTestId('script-history'));
    expect((await screen.findByTestId('script-history-item')).textContent).toContain('Before a restore was saved · 1 beat');
  });

  test('a save naming moved approved beats says so', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content }, locked_beats_kept: [], locked_beats_moved: [{ from: 1, to: 15, header: '## BEAT: 15 · New scene' }] } }));
    renderTab(SCRIPT, [1]);
    typeRaw(`${SCRIPT}\nLala: more.`);
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved. Beat 1 is approved, so your new beat was kept as beat 15.'));
  });
});

describe('H8: what a version changes', () => {
  test('lines in and out of the page', async () => {
    renderTab();
    await openVersion();
    const diff = screen.getByTestId('script-history-diff');
    expect(diff.textContent).toContain('2 lines in, 2 lines out');
    const add = [...diff.querySelectorAll('[data-type="add"]')].map((l) => l.textContent);
    const del = [...diff.querySelectorAll('[data-type="del"]')].map((l) => l.textContent);
    expect(add.join('|')).toContain('Lala: The first draft.');
    expect(del.join('|')).toContain('Lala: Hi besties.');
  });

  test('a version the same as the page is not put back', async () => {
    version = { ...version, script_content: SCRIPT };
    renderTab();
    await openVersion();
    expect(screen.getByTestId('script-history-same').textContent).toBe('This version is the same as the page.');
    expect(screen.queryByTestId('script-history-restore')).toBeNull();
  });

  test('the list is read again on reopening; a failed read offers Try again', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-history'));
    await screen.findByTestId('script-history-item');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    vi.mocked(api.get).mockImplementationOnce(async () => { throw new Error('down'); });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getByTestId('script-history'));
    fireEvent.click(await screen.findByTestId('script-history-retry'));
    expect(await screen.findByTestId('script-history-item')).toBeTruthy();
    expect(vi.mocked(api.get).mock.calls.filter(([u]) => u === '/api/v1/episodes/ep-1/script-versions').length).toBe(3);
    expect(errors).toHaveBeenCalled();
  });
});

describe('H9 and H13: focus, Escape, the backdrop', () => {
  test('a version takes focus on its heading; Escape goes back to its row; Escape again closes', async () => {
    renderTab();
    const head = await openVersion();
    await waitFor(() => expect(document.activeElement).toBe(head));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('script-history-panel')).toBeTruthy();
    const row = await screen.findByTestId('script-history-item');
    await waitFor(() => expect(document.activeElement).toBe(row));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('script-history-panel')).toBeNull();
  });

  test('"Reading…" is in a polite live region', async () => {
    let answer;
    vi.mocked(api.get).mockImplementation((url) => (url === '/api/v1/episodes/ep-1/script-versions'
      ? new Promise((r) => { answer = r; }) : Promise.resolve({ data: { data: [] } })));
    renderTab();
    fireEvent.click(screen.getByTestId('script-history'));
    const status = screen.getByTestId('script-history-status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('Reading…');
    await act(async () => { answer({ data: { data: versions } }); });
    expect(status.textContent).toBe('');
  });

  test('the backdrop closes it; History pressed again keeps the version', async () => {
    renderTab();
    await openVersion();
    fireEvent.click(screen.getByTestId('script-history'));
    expect(screen.getByTestId('script-history-version-head')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-history-backdrop'));
    expect(screen.queryByTestId('script-history-panel')).toBeNull();
  });
});

describe('dates', () => {
  test('relative, with the full time as its title; missing is fine', async () => {
    const now = new Date('2026-10-24T12:00:00').getTime();
    expect(versionTime(new Date(now - 30 * 1000).toISOString(), now).text).toBe('just now');
    expect(versionTime(new Date(now - 5 * 60 * 1000).toISOString(), now).text).toBe('5 min ago');
    expect(versionTime(new Date(now - 3600 * 1000).toISOString(), now).text).toBe('1 hour ago');
    expect(versionTime(new Date('2026-10-23T09:00:00').toISOString(), now).text).toBe('yesterday');
    expect(versionTime(new Date('2026-10-20T09:00:00').toISOString(), now).text).toBe('4 days ago');
    expect(versionTime(null)).toBeNull();
    expect(versionTime('not a date')).toBeNull();
    expect(plural(1, 'beat')).toBe('1 beat');
    expect(plural(2, 'beat')).toBe('2 beats');
    renderTab();
    fireEvent.click(screen.getByTestId('script-history'));
    const item = await screen.findByTestId('script-history-item');
    const time = within(item).getByText('2 hours ago');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('title')).toMatch(/2026/);
    expect(item.textContent).toContain('2 beats');
  });
});
