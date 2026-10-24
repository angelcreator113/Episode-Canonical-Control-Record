/**
 * Replies that land after more edits (Script tab audit, 2026-10-15). An AI
 * reply goes into the script as it is when the reply lands, not as it was
 * when the button was pressed:
 * (Each is a suggestion until "Use it"; it goes in as the script is then.)
 * - Regenerate beat finds its beat again, so a beat moved meanwhile is not
 *   written over, and a beat approved meanwhile is left alone;
 * - Rewrite line keeps edits made meanwhile, and finds its line by its words;
 * - while a new script is being written, editing, approving and saving wait.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const raw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return screen.getByRole('textbox', { name: 'Raw script' }).value; };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

describe('Regenerate beat lands on its own beat', () => {
  test('a beat moved while it is written is not written over', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(screen.getByTestId('script-beat-2').querySelector('.esp-beat-head'));
    fireEvent.click(screen.getByTestId('script-regen-beat-2'));
    fireEvent.click(screen.getByTestId('script-beat-up-2'));
    await act(async () => { reply.resolve({ data: { beat: '## BEAT: 2 · Login Sequence\nLala: Fresh login.' } }); });
    fireEvent.click(await screen.findByTestId('script-proposal-accept'));

    const text = raw();
    expect(text).toBe('## BEAT: 2 · Login Sequence\nLala: Fresh login.\n\n## BEAT: 1 · Opening Ritual\nLala: Hi besties.');
  });

  test('a beat approved while it is written keeps its approved words', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    vi.mocked(api.put).mockResolvedValue({ data: { data: { script_locked_beats: [2] } } });
    renderTab();
    fireEvent.click(screen.getByTestId('script-beat-2').querySelector('.esp-beat-head'));
    fireEvent.click(screen.getByTestId('script-regen-beat-2'));
    fireEvent.click(screen.getByTestId('script-lock-2'));
    await waitFor(() => expect(screen.getByTestId('script-lock-2').textContent).toBe('Unlock'));
    await act(async () => { reply.resolve({ data: { beat: '## BEAT: 2 · Login Sequence\nLala: Fresh login.' } }); });

    expect(await screen.findByText(/was approved or removed while it was being written/)).toBeTruthy();
    expect(raw()).toBe(SCRIPT);
  });
});

describe('Rewrite line keeps what was done meanwhile', () => {
  test('a line edited in another beat while the rewrite runs stays edited', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByRole('button', { name: /^Rewrite line:/ }));

    fireEvent.click(screen.getByTestId('script-beat-2').querySelector('.esp-beat-head'));
    fireEvent.click(within(screen.getByTestId('script-beat-2')).getByText(/Logging in\./));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: Logged in.' } });
    fireEvent.click(within(box.closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));

    await act(async () => { reply.resolve({ data: { rewrittenLine: 'Hey, gorgeous.' } }); });
    // The suggestion waits in beat 1.
    fireEvent.click(screen.getByTestId('script-beat-1').querySelector('.esp-beat-head'));
    fireEvent.click(await screen.findByTestId('script-proposal-accept'));
    const text = raw();
    expect(text).toContain('Lala: Logged in.');
    expect(text).toContain('Hey, gorgeous.');
    expect(text).not.toContain('Hi besties.');
  });

  test('a line changed while it is rewritten is not overwritten', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByRole('button', { name: /^Rewrite line:/ }));
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText(/Hi besties\./));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Lala: My own words.' } });
    fireEvent.click(within(box.closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));

    await act(async () => { reply.resolve({ data: { rewrittenLine: 'Hey, gorgeous.' } }); });
    fireEvent.click(await screen.findByTestId('script-proposal-accept'));
    expect(await screen.findByText(/changed or was approved while it was being rewritten/)).toBeTruthy();
    const text = raw();
    expect(text).toContain('Lala: My own words.');
    expect(text).not.toContain('Hey, gorgeous.');
  });
});

describe('While a new script is written', () => {
  test('saving and approving wait, and the page says so', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      renderTab();
      fireEvent.click(screen.getByTestId('script-beat-down-1'));
      fireEvent.click(screen.getByTestId('script-regenerate'));
      expect(await screen.findByTestId('script-generating')).toBeTruthy();
      expect(screen.getByTestId('script-savebar-save').disabled).toBe(true);
      // Beat 1 stays open where it moved, so its Approve button is on screen.
      // aria-disabled, so focus stays on it (Script page audit 3, 2026-10-19).
      expect(screen.getByTestId('script-lock-1').getAttribute('aria-disabled')).toBe('true');
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
      expect(api.put).not.toHaveBeenCalled();

      await act(async () => { reply.resolve({ data: { saved: true, script: SCRIPT } }); });
      await waitFor(() => expect(screen.queryByTestId('script-generating')).toBeNull());
      expect(screen.getByTestId('script-lock-1').getAttribute('aria-disabled')).toBeNull();
    } finally { confirm.mockRestore(); }
  });
});
