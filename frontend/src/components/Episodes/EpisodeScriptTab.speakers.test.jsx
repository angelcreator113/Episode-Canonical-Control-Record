/**
 * Speakers and inputs (Script tab re-audit, 2026-10-15):
 * - Rewrite keeps `Lala (V.O.):`, two-word and inner-capital speakers;
 * - Move up/down steps past a hidden [STAT:] line;
 * - a [UI: line the tab can't read shows, a lowercase one is a moment;
 * - while one beat is written, the others' Regenerate and Ask wait;
 * - an adder keeps its words when the line can't be added yet.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab, { rewrittenLine } from './EpisodeScriptTab';

const renderTab = (script) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const raw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return screen.getByRole('textbox', { name: 'Raw script' }).value; };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

describe('rewrittenLine', () => {
  test('keeps the speaker the tab shows', () => {
    expect(rewrittenLine('Lala (V.O.): "Hi there"', 'Hello')).toBe('Lala (V.O.): "Hello"');
    expect(rewrittenLine('Mary Jane: "Hi"', 'Hello')).toBe('Mary Jane: "Hello"');
    expect(rewrittenLine('JustAWoman: "Hi"', 'Hello')).toBe('JustAWoman: "Hello"');
  });
  test('a direction stays, another lead-in is words, and a bare label gets its space', () => {
    // Re-audit 2 (2026-10-15).
    expect(rewrittenLine('Lala: (softly) "I love it."', 'I adore it.')).toBe('Lala: (softly) "I adore it."');
    expect(rewrittenLine('Lala: "Hi."', "Listen: I'm not going.")).toBe('Lala: "Listen: I\'m not going."');
    expect(rewrittenLine('Me:', 'Okay then.')).toBe('Me: Okay then.');
  });

  test('a reply that repeats the speaker, or quotes inside, is read for its words', () => {
    expect(rewrittenLine('Lala: "Hi"', 'Lala (whisper): "Hello"')).toBe('Lala: "Hello"');
    expect(rewrittenLine('Lala: Hi', '"Hello," she said.')).toBe('Lala: "Hello," she said.');
  });
});

describe('lines', () => {
  test('Move up steps past a hidden [STAT:] line', () => {
    renderTab('## BEAT: 1 · Opening Ritual\nLala: A\n[STAT: coins +5]\nLala: B');
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText('"B"'));
    fireEvent.click(screen.getByRole('button', { name: 'Move line up' }));
    expect(raw()).toBe('## BEAT: 1 · Opening Ritual\nLala: B\nLala: A\n[STAT: coins +5]');
  });

  test('Move up is off for the first line shown', () => {
    renderTab('## BEAT: 1 · Opening Ritual\n[STAT: coins +5]\nLala: A\nLala: B');
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText('"A"'));
    expect(screen.getByRole('button', { name: 'Move line up' }).disabled).toBe(true);
  });

  test("JustAWoman's sound and edit cues show as short notes", () => {
    // Evoni, 2026-10-17.
    renderTab('## BEAT: 4 · Interruption Pulse 1\n[SFX: notification ping]\n[EDIT: punch-in on her corner frame]\nMe: (looks toward the notification) "Hold on, who is texting us?"');
    const beat = within(screen.getByTestId('script-beat-4'));
    expect(beat.getByText('Sound: notification ping')).toBeTruthy();
    expect(beat.getByText('Edit: punch-in on her corner frame')).toBeTruthy();
  });

  test("a [UI: line the tab can't read shows as written", () => {
    renderTab('## BEAT: 1 · Opening Ritual\n[UI:CLICK MailIcon] (she taps)\nLala: A');
    expect(within(screen.getByTestId('script-beat-1')).getByText('[UI:CLICK MailIcon] (she taps)')).toBeTruthy();
  });
});

describe('writing waits', () => {
  test("while beat 1 is written, beat 2's Regenerate and Ask wait", async () => {
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}));
    renderTab('## BEAT: 1 · Opening Ritual\nLala: Hi.\n\n## BEAT: 2 · Login Sequence\nLala: In.');
    fireEvent.click(screen.getByTestId('script-regen-beat-1'));
    fireEvent.click(screen.getByTestId('script-beat-2').querySelector('.esp-beat-head'));
    fireEvent.change(screen.getByTestId('script-ask-input-2'), { target: { value: 'punchier' } });
    await waitFor(() => expect(screen.getByTestId('script-regen-beat-2').disabled).toBe(true));
    expect(screen.getByTestId('script-ask-send-2').disabled).toBe(true);
    fireEvent.keyDown(screen.getByTestId('script-ask-input-2'), { key: 'Enter' });
    expect(screen.getByTestId('script-ask-input-2').value).toBe('punchier');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  test('while a new script is written, a line adder keeps its words', async () => {
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTab('## BEAT: 1 · Opening Ritual\nLala: Hi.');
    fireEvent.click(screen.getByTestId('script-add-line-1'));
    fireEvent.change(screen.getByTestId('script-line-adder-text'), { target: { value: 'My new line' } });
    fireEvent.click(screen.getByTestId('script-regenerate'));
    expect(await screen.findByTestId('script-generating')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-line-adder-add'));
    expect(screen.getByTestId('script-line-adder-text').value).toBe('My new line');
    expect(await screen.findByText('Wait for the new script before adding to it.')).toBeTruthy();
  });
});

describe('moving a line being edited', () => {
  test('Move waits for the typed words to be saved', () => {
    renderTab('## BEAT: 1 · Opening Ritual\nLala: first\nLala: second');
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByText('"first"'));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    expect(screen.getByRole('button', { name: 'Move line down' }).disabled).toBe(false);
    fireEvent.change(box, { target: { value: 'Lala: first, rewritten by hand' } });
    expect(screen.getByRole('button', { name: 'Move line down' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Move line down' }).title).toBe('Save the line first');
  });
});

