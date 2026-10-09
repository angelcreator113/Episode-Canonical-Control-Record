/**
 * Evoni, 2026-10-09 (Task #2785): "In order to save I need to scroll all the
 * way up even if I'm at beat 11 and when I regenerate I have to refresh the
 * page to see it but what if I only want to regenerate a line or a beat?"
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';
import { replaceBeat } from '../../lib/scriptBeatOrder';

const SCRIPT = '[EVENT: name="Gala"]\n\n## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = (locked = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: locked }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});
afterEach(() => { vi.useRealTimers(); });

describe('Save from anywhere', () => {
  test('the bottom Save bar shows only while there are unsaved changes, and saves', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    renderTab();
    expect(screen.queryByTestId('script-savebar')).toBeNull();
    fireEvent.click(screen.getByTestId('script-beat-down-1'));
    fireEvent.click(screen.getByTestId('script-savebar-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('script-savebar')).toBeNull());
  });
});

describe('Regenerate one beat', () => {
  test('puts the new beat in place of the old one only, unsaved until Save', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { beat: '## BEAT: 2 · Login Sequence\nLala: Fresh login.' } });
    renderTab();
    fireEvent.click(screen.getByTestId('script-beat-2').querySelector('.esp-beat-head'));
    fireEvent.click(screen.getByTestId('script-regen-beat-2'));
    await waitFor(() => expect(screen.getByTestId('script-beat-2').textContent).toContain('Fresh login.'));
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/episode-brief/ep-1/regenerate-beat');
    expect(body).toEqual({ showId: 'show-1', beatNumber: 2, script: SCRIPT });
    expect(screen.getByTestId('script-dirty')).toBeTruthy();
    expect(screen.getByTestId('script-savebar')).toBeTruthy();
  });

  test('a locked beat has no Regenerate beat button', () => {
    renderTab([1]);
    expect(within(screen.getByTestId('script-beat-1')).queryByTestId('script-regen-beat-1')).toBeNull();
  });

  test('replaceBeat keeps the text before the first beat and every other beat', () => {
    expect(replaceBeat(SCRIPT, 0, '## BEAT: 1 · Opening Ritual\nLala: New.')).toBe('[EVENT: name="Gala"]\n\n## BEAT: 1 · Opening Ritual\nLala: New.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.');
    expect(replaceBeat(SCRIPT, 5, '## BEAT: 6 · x\ny')).toBe(SCRIPT);
    expect(replaceBeat(SCRIPT, 0, 'no header')).toBe(SCRIPT);
  });
});

describe('Regenerate that outlasts its request', () => {
  test('a gateway timeout waits for the saved script and shows it without a refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('Request failed with status code 504'), { response: { status: 504, data: '<html>504</html>' } }));
    const NEW = '## BEAT: 1 · Opening Ritual\nLala: Brand new script.';
    let calls = 0;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url !== '/api/v1/episodes/ep-1') return { data: { data: [] } };
      calls += 1;
      return { data: { data: { script_content: calls < 2 ? SCRIPT : NEW } } };
    });
    renderTab();
    fireEvent.click(screen.getByTestId('script-regenerate'));
    await waitFor(() => expect(screen.getByTestId('script-waiting')).toBeTruthy());
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(screen.queryByText(/Brand new script/)).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    await waitFor(() => expect(screen.getByTestId('script-beat-1').textContent).toContain('Brand new script.'));
    expect(screen.queryByTestId('script-waiting')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('script-savebar')).toBeNull();
  });

  test('an error the server itself sent is shown, not waited out', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('500'), { response: { status: 500, data: { error: 'Episode Brief not found.' } } }));
    renderTab();
    fireEvent.click(screen.getByTestId('script-regenerate'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Episode Brief not found.'));
    expect(screen.queryByTestId('script-waiting')).toBeNull();
  });
});
