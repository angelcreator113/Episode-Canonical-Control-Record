/**
 * How the Script tab reads beats and lines (Script tab audit, 2026-10-15):
 * - a skeleton header by name (`## BEAT: TRANSFORMATION`) is its canonical
 *   beat, so Regenerate beat writes that beat and no other;
 * - a script with no `## BEAT:` header can be moved and added to (each
 *   action first gives it headers);
 * - "## BEAT:" inside a line is not a header;
 * - cue lines read as short notes, not narration; `Lala (V.O.):` is Lala;
 *   `Location:` is not a person; curly quotes are not doubled.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab, { parseScriptIntoBeats, withBeatHeaders } from './EpisodeScriptTab';

const renderTab = (script) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const raw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return screen.getByRole('textbox', { name: 'Raw script' }).value; };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

describe('named beat headers', () => {
  const SKELETON = '## BEAT: OPENING_RITUAL\nLala: Hi.\n\n## BEAT: STAKES_INTENTION\nLala: This is it.\n\n## BEAT: TRANSFORMATION\n[UI:OPEN Closet]\nLala: The gold dress.';

  test('each is its canonical beat', () => {
    expect(parseScriptIntoBeats(SKELETON).map((b) => [b.number, b.name])).toEqual([
      [1, 'Opening Ritual'], [6, 'Strategic Reaction'], [8, 'Transformation Loop'],
    ]);
  });

  test('Regenerate beat on TRANSFORMATION asks for beat 8', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { beat: '## BEAT: 8 · Transformation Loop\nLala: Fresh.' } });
    renderTab(SKELETON);
    fireEvent.click(screen.getByTestId('script-beat-8').querySelector('.esp-beat-head'));
    fireEvent.click(screen.getByTestId('script-regen-beat-8'));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ beatNumber: 8 });
  });
});

describe('a script with no beat headers', () => {
  const PLAIN = 'Lala: One.\nLala: Two.\nLala: Three.';

  test('gets one header per shown beat', () => {
    expect(withBeatHeaders(PLAIN)).toBe('## BEAT: 1 · Opening Ritual\nLala: One.\n\n## BEAT: 2 · Login Sequence\nLala: Two.\n\n## BEAT: 3 · Welcome\nLala: Three.');
    expect(withBeatHeaders('## BEAT: 1 · X\nA')).toBe('## BEAT: 1 · X\nA');
  });

  test('moving a beat works', () => {
    renderTab(PLAIN);
    fireEvent.click(screen.getByTestId('script-beat-down-1'));
    expect(raw()).toBe('## BEAT: 2 · Login Sequence\nLala: Two.\n\n## BEAT: 1 · Opening Ritual\nLala: One.\n\n## BEAT: 3 · Welcome\nLala: Three.');
  });
});

describe('lines', () => {
  test('"## BEAT:" inside a line is not a header', () => {
    const beats = parseScriptIntoBeats('## BEAT: 1 · Opening Ritual\nLala: "Say ## BEAT: drop"\n\n## BEAT: 2 · Login Sequence\nMe: hi');
    expect(beats.map((b) => b.number)).toEqual([1, 2]);
    expect(beats[0].lines).toEqual(['Lala: "Say ## BEAT: drop"']);
  });

  test('cues are short notes; V.O. keeps its speaker; a label is not a speaker; curly quotes are not doubled', () => {
    renderTab('## BEAT: 1 · Opening Ritual\n[TRANSITION: cut to the closet]\n[WEAR: 3f2a9c1e-0000-4000-8000-000000000001]\nLala (V.O.): "Bestie."\nLocation: The penthouse\nLala: “Hi.”');
    const beat = screen.getByTestId('script-beat-1');
    expect(within(beat).getByText('Transition: cut to the closet').className).toBe('esp-line-cue');
    expect(within(beat).getByText('Puts on a piece of the look')).toBeTruthy();
    expect(within(beat).queryByText(/3f2a9c1e/)).toBeNull();
    const speakers = within(beat).getAllByText(/^(Lala|Location)$/).map((el) => el.textContent);
    expect(speakers).toEqual(['Lala', 'Lala']);
    expect(within(beat).getByText('Location: The penthouse')).toBeTruthy();
    expect(within(beat).getByText('"Hi."')).toBeTruthy();
  });
});
