/**
 * Locked script beats (Evoni, 2026-10-08: "yes start with lock then drag
 * and drop"). Approve is the lock: it is kept on the episode, a locked
 * beat can't be edited or rewritten, and Regenerate says it keeps it.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab, { parseScriptIntoBeats, scriptPreamble } from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.\n';
const renderTab = (locked = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: locked }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

describe('Script beat locks', () => {
  test('a locked beat number reads as approved', () => {
    expect(parseScriptIntoBeats(SCRIPT, [2]).map((b) => b.approved)).toEqual([false, true]);
  });

  test('a tag before the first beat is not a beat, so numbers match the locks', () => {
    const beats = parseScriptIntoBeats(`[EVENT: name="Gala"]\n\n## BEAT: CLIFFHANGER\nx\n\n## BEAT: 2 · Login Sequence\ny`, [1]);
    expect(beats.map((b) => [b.number, b.approved])).toEqual([[1, true], [2, false]]);
    expect(scriptPreamble('[EVENT: name="Gala"]\n\n## BEAT: 1 · Opening Ritual\nx')).toBe('[EVENT: name="Gala"]');
  });

  test('editing a line keeps the tag before the first beat and the other beats exactly', async () => {
    const script = `[EVENT: name="Gala"]\n\n${SCRIPT.replace('Lala: Logging in.', 'Lala: Logging in.\n\n(She waves.)')}`;
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    render(<MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [2] }} show={{ id: 'show-1' }} /></MemoryRouter>);
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getAllByTestId('script-line')[0]);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Lala: Hello gala.' } });
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByRole('button', { name: 'Save' }));
    fireEvent.click(within(screen.getByTestId('script-head')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).toBe('[EVENT: name="Gala"]\n\n## BEAT: 1 · Opening Ritual\nLala: Hello gala.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.\n\n(She waves.)');
  });

  test('a beat locked on the episode shows approved after a reload', () => {
    renderTab([1]);
    expect(screen.getByTestId('script-head').textContent).toContain('2 beats · 1 approved');
    expect(screen.getByTestId('script-beat-1').getAttribute('data-locked')).toBe('true');
  });

  test('Approve & lock keeps the lock on the episode', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: 'ep-1', script_locked_beats: [1], script_content: SCRIPT } } });
    renderTab();
    fireEvent.click(screen.getByTestId('script-lock-1'));
    await waitFor(() => expect(screen.getByTestId('script-beat-1').getAttribute('data-locked')).toBe('true'));
    expect(api.put).toHaveBeenCalledWith('/api/v1/episodes/ep-1/script-locks', { locked_beats: [1] });
    expect(screen.getByTestId('script-lock-1').textContent).toBe('Unlock');
  });

  test("a lock that can't be saved stays off and says so", async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { data: { error: 'Episode not found' } } });
    renderTab();
    fireEvent.click(screen.getByTestId('script-lock-1'));
    await screen.findByText('Episode not found');
    expect(screen.getByTestId('script-beat-1').getAttribute('data-locked')).toBe('false');
  });

  test("a locked beat's lines can't be edited or rewritten", () => {
    renderTab([1]);
    const line = within(screen.getByTestId('script-beat-1')).getAllByTestId('script-line')[0];
    expect(within(line).queryByText('✦ Rewrite')).toBeNull();
    fireEvent.click(line);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  test('locking after an edit saves the edit with the lock', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { id: 'ep-1', script_locked_beats: body.locked_beats, script_content: body.script_content } } }));
    renderTab();
    const line = within(screen.getByTestId('script-beat-1')).getAllByTestId('script-line')[0];
    fireEvent.click(line);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Lala: Hello gala.' } });
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByTestId('script-lock-1'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/episodes/ep-1/script-locks');
    expect(body.locked_beats).toEqual([1]);
    expect(body.script_content).toContain('Lala: Hello gala.');
  });

  test('Regenerate says the approved beats stay, and asks once', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.post).mockResolvedValue({ data: { saved: true, script: SCRIPT, locked_kept: [1] } });
    renderTab([1]);
    fireEvent.click(screen.getByTestId('script-regenerate'));
    expect(confirm).toHaveBeenCalledWith('Regenerate the unlocked beats? The 1 approved beat stays exactly as it is; the rest of the script is replaced.');
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/generate-script', { showId: 'show-1', confirmOverwrite: true }));
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });
});
