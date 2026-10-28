// Scene notes off by default in the teleprompter (Evoni, 2026-10-28: "I don't
// need the scene set when reading the teleprompter… I think that will help
// improve actual timing"): the (bracketed) stage directions are not read
// aloud, so they neither show nor hold the reading line, unless she turns
// "Show scene notes" on. A (breath) mark stays.
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(async () => ({ data: { data: [] } })), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import TeleprompterReader, { SETTINGS_KEY } from '../components/Teleprompter/TeleprompterReader';
import { teleprompterScript, withoutSceneNotes } from '../lib/teleprompterLines';

const SCRIPT = [
  '## BEAT: 2 · Login Sequence',
  "(Lala's bedroom shows behind the login screen.)",
  'Me: "Ohhhh, this bedroom!"',
  '(breath)',
  '[UI:CLICK Login field]',
  '(The saved login fills in.)',
  'Lala: "Bestie!"',
  'Me: "We are IN!"',
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: null, title: 'Ep 1' };

beforeEach(() => {
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
});

describe('scene notes', () => {
  test('withoutSceneNotes leaves out the directions and keeps a breath; voice clip indexes keep counting them', () => {
    const { beats } = teleprompterScript(SCRIPT);
    const kept = withoutSceneNotes(beats[0].lines);
    expect(kept.map((l) => l.kind)).toEqual(['mine', 'breath', 'screen', 'cue', 'mine']);
    // "We are IN!" is line 6 of the beat whether or not the notes show.
    expect(kept[kept.length - 1].vi).toBe(5);
  });

  test('hidden by default; "Show scene notes" brings them back and is remembered', () => {
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    expect(screen.queryAllByTestId('stp-direction').filter((l) => !l.className.includes('is-breath'))).toHaveLength(0);
    expect(screen.getByTestId('teleprompter').textContent).not.toMatch(/bedroom shows|saved login fills/);
    expect(screen.getByTestId('stp-breath')).toBeTruthy();
    const toggle = screen.getByTestId('stp-scene-notes-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getAllByTestId('stp-direction').map((l) => l.textContent)).toEqual(["Lala's bedroom shows behind the login screen.", 'The saved login fills in.']);
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY)).sceneNotes).toBe(true);
  });

  test('no switch when the script has no scene notes', () => {
    render(<TeleprompterReader source={{ ...source, scriptText: '## BEAT: 1 · Opening\nMe: "Hi."' }} onClose={() => {}} />);
    expect(screen.queryByTestId('stp-scene-notes-toggle')).toBeNull();
  });
});
