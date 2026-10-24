/**
 * Ask for a change (Script tab audit, 2026-10-15): Regenerate beat with
 * Evoni's own words for it. And each beat's rough length.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = (locked = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: locked }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

describe('Ask for a change', () => {
  test('sends the words with the beat, and puts the new beat in place', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { beat: '## BEAT: 1 · Opening Ritual\nLala: Punchier hello.' } });
    renderTab();
    const send = screen.getByTestId('script-ask-send-1');
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('script-ask-input-1'), { target: { value: '  punchier  ' } });
    fireEvent.click(send);
    await waitFor(() => expect(screen.getByTestId('script-beat-1').textContent).toContain('Punchier hello.'));
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/episode-brief/ep-1/regenerate-beat');
    expect(body).toEqual({ showId: 'show-1', beatNumber: 1, script: SCRIPT, instruction: 'punchier' });
    expect(screen.getByTestId('script-ask-input-1').value).toBe('');
  });

  test('Enter in the box asks too', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { beat: '## BEAT: 1 · Opening Ritual\nLala: More Lala.' } });
    renderTab();
    const input = screen.getByTestId('script-ask-input-1');
    fireEvent.change(input, { target: { value: 'more Lala' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1].instruction).toBe('more Lala');
  });

  test('plain Regenerate beat sends no instruction', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { beat: '## BEAT: 1 · Opening Ritual\nLala: Fresh.' } });
    renderTab();
    fireEvent.click(screen.getByTestId('script-regen-beat-1'));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('instruction');
  });

  test('a locked beat has no box', () => {
    renderTab([1]);
    expect(within(screen.getByTestId('script-beat-1')).queryByTestId('script-ask-1')).toBeNull();
  });
});

describe('Runtime', () => {
  test('each beat head and the script card show the rough length', () => {
    renderTab();
    // "Hi besties." is 2 words at 150 a minute: under a second, ~1s.
    expect(screen.getByTestId('script-beat-runtime-1').textContent).toBe('~1s');
    expect(screen.getByTestId('script-runtime').textContent).toBe('~2s');
    expect(screen.getByTestId('script-head').textContent).toContain('2 beats · ~2s · 0 of 14 approved');
  });
});
