/**
 * The script revision (architecture A1c R1, Evoni, 2026-10-27;
 * src/services/scriptSave.js): Save and Approve send the revision of the
 * saved script the page's edits were made on, and the server refuses a write
 * against any other one. A refusal keeps the page's text and says what to do:
 * "Load the newer script" puts the newer one on the page and keeps the
 * person's text behind "Put them back"; "Compare" shows both.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\n(Lala opens the closet)\nLala: "Hi besties."\n';
const NEWER = '## BEAT: 1 · Opening Ritual\n(Lala opens the closet)\nLala: "Hello from the other tab."\n';
const REV1 = `sr1-${'a'.repeat(40)}`;
const REV2 = `sr1-${'b'.repeat(40)}`;
const REV3 = `sr1-${'c'.repeat(40)}`;

// The server's copy of the episode, as GET /episodes/:id answers it.
let server;
const renderTab = (script = SCRIPT) => render(
  <MemoryRouter>
    <EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script }} show={{ id: 'show-1' }} />
  </MemoryRouter>,
);
const raw = () => screen.getByRole('textbox', { name: 'Raw script' });
const typeAndSave = async (text) => {
  fireEvent.click(await screen.findByRole('button', { name: 'Raw editor' }));
  fireEvent.change(raw(), { target: { value: text } });
  fireEvent.keyDown(window, { key: 's', ctrlKey: true });
};
const refusal = (code, error, extra = {}) => Object.assign(new Error(code), { response: { status: 409, data: { success: false, code, error, ...extra } } });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  try { window.localStorage.clear(); } catch { /* no storage */ }
  server = { script: SCRIPT, revision: REV1 };
  vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/episodes/ep-1'
    ? { data: { data: { id: 'ep-1', script_content: server.script, script_locked_beats: [] }, script_revision: server.revision } }
    : { data: { data: [] } }));
});
afterEach(() => { vi.restoreAllMocks(); });

describe('EpisodeScriptTab: the script revision', () => {
  test('Save sends the revision the page read, and the next Save the one the save returned', async () => {
    vi.mocked(api.put).mockImplementation(async (_url, body) => ({ data: { success: true, data: { script_content: body.script_content }, script_revision: REV2 } }));
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    const first = `${SCRIPT}Lala: "One."\n`;
    await typeAndSave(first);
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0]).toEqual(['/api/v1/episodes/ep-1', { script_content: first, script_revision: REV1 }]);

    await screen.findByTestId('script-saved');
    const second = `${first}Lala: "Two."\n`;
    fireEvent.change(raw(), { target: { value: second } });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.put).mock.calls[1][1]).toEqual({ script_content: second, script_revision: REV2 });
  });

  test('Approve sends the revision too, a lock with no text included', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: 'ep-1', script_locked_beats: [1], script_content: SCRIPT }, script_revision: REV1 } });
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    fireEvent.click(screen.getByTestId('script-lock-1'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episodes/ep-1/script-locks', { locked_beats: [1], script_revision: REV1 }));
  });

  test('a newer script taken while the page had edits becomes the base, with its own revision', async () => {
    server = { script: NEWER, revision: REV2 };
    vi.mocked(api.put).mockRejectedValue(refusal('SCRIPT_REVISION_REQUIRED', 'This page is out of date.'));
    renderTab();
    // Edited before the check came back: the newer script is the base, and the banner asks.
    fireEvent.click(await screen.findByRole('button', { name: 'Raw editor' }));
    fireEvent.change(raw(), { target: { value: `${SCRIPT}Lala: "Mine."\n` } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    // The base is the newer script, read with its revision: "Keep mine" is the person's choice.
    expect(vi.mocked(api.put).mock.calls[0][1].script_revision).toBe(REV2);
  });

  test('SCRIPT_CHANGED: nothing is lost, and Load the newer script keeps the text behind Put them back', async () => {
    vi.mocked(api.put).mockRejectedValue(refusal('SCRIPT_CHANGED', 'This script changed since you opened it. Nothing was saved.'));
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    const mine = `${SCRIPT}Lala: "Mine."\n`;
    await typeAndSave(mine);
    const banner = await screen.findByTestId('script-conflict');
    expect(banner.textContent).toContain('Not saved.');
    expect(banner.textContent).toContain('This script changed since you opened it.');
    expect(raw().value).toBe(mine);
    expect(screen.queryByText('Save failed')).toBeNull();

    server = { script: NEWER, revision: REV2 };
    fireEvent.click(screen.getByTestId('script-conflict-load'));
    await waitFor(() => expect(raw().value).toBe(NEWER));
    expect(screen.queryByTestId('script-conflict')).toBeNull();
    expect(screen.getByTestId('script-saved')).toBeTruthy();
    const offer = screen.getByTestId('script-draft');
    expect(offer.textContent).toContain('The saved script has changed since.');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByTestId('script-draft-restore'));
    expect(raw().value).toBe(mine);

    // Saving it now is against the newer script's revision: a choice, not an accident.
    vi.mocked(api.put).mockReset();
    vi.mocked(api.put).mockImplementation(async (_url, body) => ({ data: { success: true, data: { script_content: body.script_content }, script_revision: REV3 } }));
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episodes/ep-1', { script_content: mine, script_revision: REV2 }));
  });

  test('SCRIPT_REVISION_REQUIRED says so; Compare shows the newer script beside the page\'s', async () => {
    vi.mocked(api.put).mockRejectedValue(refusal('SCRIPT_REVISION_REQUIRED', 'This page is out of date. Reload to see the current script.'));
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    const mine = `${SCRIPT}Lala: "Mine."\n`;
    await typeAndSave(mine);
    expect((await screen.findByTestId('script-conflict')).textContent).toContain('This page is out of date.');

    server = { script: NEWER, revision: REV2 };
    fireEvent.click(screen.getByTestId('script-conflict-compare'));
    expect((await screen.findByTestId('script-newer-script')).textContent).toBe(NEWER);
    expect(raw().value).toBe(mine);
    expect(screen.queryByTestId('script-conflict')).toBeNull();
  });

  test('LINE_IDENTITY_ACTIVE says so and offers no overwrite', async () => {
    vi.mocked(api.put).mockRejectedValue(refusal('LINE_IDENTITY_ACTIVE', 'Line identities are active for this episode. Nothing was saved.'));
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    const mine = `${SCRIPT}Lala: "Mine."\n`;
    await typeAndSave(mine);
    const banner = await screen.findByTestId('script-conflict');
    expect(banner.textContent).toContain('Line identities are active');
    expect(screen.queryByTestId('script-conflict-load')).toBeNull();
    expect(screen.queryByTestId('script-conflict-compare')).toBeNull();
    expect(raw().value).toBe(mine);
  });

  test('a refused Approve keeps the beat unlocked and says why', async () => {
    vi.mocked(api.put).mockRejectedValue(refusal('SCRIPT_CHANGED', 'This script changed since you opened it. Nothing was saved.'));
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    fireEvent.click(screen.getByTestId('script-lock-1'));
    expect((await screen.findByTestId('script-conflict')).textContent).toContain('This script changed');
    expect(screen.getByTestId('script-beat-1').getAttribute('data-locked')).not.toBe('true');
  });

  test('a generated script the server would not save over a newer one stays on the page, unsaved', async () => {
    server = { script: '', revision: REV1 };
    const DRAFT = '## BEAT: 1 · Opening Ritual\nLala: "Written while you edited elsewhere."\n';
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/generate-script')) {
        server = { script: NEWER, revision: REV2 };
        throw refusal('SCRIPT_CHANGED', 'The script changed while this one was being written, so it was not saved over the newer script.', { draft: DRAFT, saved: false });
      }
      return { data: {} };
    });
    renderTab('');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    fireEvent.click(await screen.findByRole('button', { name: /Generate Script/ }));
    expect((await screen.findByTestId('script-unsaved')).textContent).toContain('it was not saved over the newer script');
    expect(await screen.findByTestId('script-newer')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-newer-view'));
    expect(screen.getByTestId('script-newer-script').textContent).toBe(NEWER);
    expect(api.put).not.toHaveBeenCalled();
  });
});
