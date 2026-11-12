/**
 * A filmed episode's script on the Script tab (Evoni, 2026-11-12;
 * src/services/scriptSave.js, lib/filmedScriptConfirm): the first Save of an
 * edit is asked about once, later Saves while the tab is open are not, a
 * "no" saves nothing and keeps the text, a tab opened again asks again, and
 * Regenerate's refusal is shown as the server words it.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';
import { FILMED_CONFIRM_QUESTION, FILMED_DECLINED_NOTE } from '../../lib/filmedScriptConfirm';

const SCRIPT = '## BEAT: 1 · Opening Ritual\n(Lala opens the closet)\nLala: "Hi besties."\n';
const REV1 = `sr1-${'a'.repeat(40)}`;
const REV2 = `sr1-${'b'.repeat(40)}`;

const renderTab = () => render(
  <MemoryRouter>
    <EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT }} show={{ id: 'show-1' }} />
  </MemoryRouter>,
);
const raw = () => screen.getByRole('textbox', { name: 'Raw script' });
const typeAndSave = async (text) => {
  fireEvent.click(await screen.findByRole('button', { name: 'Raw editor' }));
  fireEvent.change(raw(), { target: { value: text } });
  fireEvent.keyDown(window, { key: 's', ctrlKey: true });
};
const refusal = (code, error, extra = {}) => Object.assign(new Error(code), { response: { status: 409, data: { success: false, code, error, ...extra } } });
// The server as scriptSave answers a filmed episode: asks until the body carries this episode's id.
const filmedServer = () => vi.mocked(api.put).mockImplementation(async (_url, body) => {
  if (body.script_content !== undefined && body.confirm_filmed_edit !== 'ep-1') throw refusal('FILMED_SCRIPT_CONFIRMATION_REQUIRED', 'This episode has been filmed.', { episode_id: 'ep-1' });
  return { data: { success: true, data: { script_content: body.script_content }, script_revision: REV2 } };
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  try { window.localStorage.clear(); } catch { /* no storage */ }
  vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/episodes/ep-1'
    ? { data: { data: { id: 'ep-1', script_content: SCRIPT, script_locked_beats: [] }, script_revision: REV1 } }
    : { data: { data: [] } }));
});
afterEach(() => { vi.restoreAllMocks(); });

describe('EpisodeScriptTab: a filmed episode\'s script', () => {
  test('the first Save is asked about once and sent again with this episode\'s id; the next Save brings it without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    filmedServer();
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    const first = `${SCRIPT}Lala: "One."\n`;
    await typeAndSave(first);
    await screen.findByTestId('script-saved');
    expect(confirm.mock.calls).toEqual([[FILMED_CONFIRM_QUESTION]]);
    const puts = () => vi.mocked(api.put).mock.calls;
    expect(puts()).toEqual([
      ['/api/v1/episodes/ep-1', { script_content: first, script_revision: REV1 }],
      ['/api/v1/episodes/ep-1', { script_content: first, script_revision: REV1, confirm_filmed_edit: 'ep-1' }],
    ]);

    const second = `${first}Lala: "Two."\n`;
    fireEvent.change(raw(), { target: { value: second } });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(puts()).toHaveLength(3));
    expect(puts()[2][1]).toEqual({ script_content: second, script_revision: REV2, confirm_filmed_edit: 'ep-1' });
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  test('"no": nothing is saved, the text stays on the page, and the next Save asks again', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    filmedServer();
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    const edited = `${SCRIPT}Lala: "One."\n`;
    await typeAndSave(edited);
    expect(await screen.findByText(FILMED_DECLINED_NOTE)).toBeTruthy();
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(raw().value).toBe(edited);
    expect(screen.queryByTestId('script-saved')).toBeNull();

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.put).mock.calls.every(([, body]) => body.confirm_filmed_edit === undefined)).toBe(true);
  });

  test('the answer is not kept past the tab: opened again, the first Save asks again', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    filmedServer();
    const first = renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    await typeAndSave(`${SCRIPT}Lala: "One."\n`);
    await screen.findByTestId('script-saved');
    expect(confirm).toHaveBeenCalledTimes(1);
    first.unmount();

    vi.mocked(api.put).mockClear();
    renderTab();
    await typeAndSave(`${SCRIPT}Lala: "Again."\n`);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.put).mock.calls[0][1].confirm_filmed_edit).toBeUndefined();
  });

  test('an episode that is not filmed saves as before: one request, no question, no extra field', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    vi.mocked(api.put).mockImplementation(async (_url, body) => ({ data: { success: true, data: { script_content: body.script_content }, script_revision: REV2 } }));
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));
    const text = `${SCRIPT}Lala: "One."\n`;
    await typeAndSave(text);
    await screen.findByTestId('script-saved');
    expect(vi.mocked(api.put).mock.calls).toEqual([['/api/v1/episodes/ep-1', { script_content: text, script_revision: REV1 }]]);
    expect(confirm).not.toHaveBeenCalled();
  });
});
