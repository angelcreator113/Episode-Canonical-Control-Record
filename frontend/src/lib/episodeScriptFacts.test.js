/**
 * The script facts a page reads when the episode comes without its script
 * (a reader who is not an admin; Evoni, 2026-11-22). The text decides when
 * it is there, so an admin's page reads exactly as before.
 */
import { describe, test, expect } from 'vitest';
import { hasScript, scriptLineCount, approvedBeatCountFact } from './episodeScriptFacts';
import { approvedBeatCount, approvedBeats } from './productionSteps';

describe('hasScript', () => {
  test('the text decides when the episode carries it', () => {
    expect(hasScript({ script_content: 'INT. LOFT' })).toBe(true);
    expect(hasScript({ script_content: '' })).toBe(false);
    expect(hasScript({ script_content: '  \n ' })).toBe(false);
    // The text wins over the fact: a page that just saved a script holds the newer answer.
    expect(hasScript({ script_content: 'INT. LOFT', has_script: false })).toBe(true);
    expect(hasScript({ script_content: '', has_script: true })).toBe(false);
  });

  test('without the text, the server\'s has_script', () => {
    expect(hasScript({ has_script: true })).toBe(true);
    expect(hasScript({ has_script: false })).toBe(false);
    expect(hasScript({ script_content: null, has_script: true })).toBe(true);
    // Only true is a yes.
    expect(hasScript({ has_script: 'yes' })).toBe(false);
    expect(hasScript({ has_script: 1 })).toBe(false);
  });

  test('neither: no script; and no episode does not throw', () => {
    expect(hasScript({})).toBe(false);
    expect(hasScript(null)).toBe(false);
    expect(hasScript(undefined)).toBe(false);
  });
});

describe('scriptLineCount', () => {
  test('counted from the text when the episode carries it', () => {
    expect(scriptLineCount({ script_content: 'a\nb\nc' })).toBe(3);
    expect(scriptLineCount({ script_content: 'a\nb\nc', script_line_count: 99 })).toBe(3);
  });

  test('without the text, the server\'s script_line_count; nothing usable is 0', () => {
    expect(scriptLineCount({ script_line_count: 42 })).toBe(42);
    expect(scriptLineCount({ script_line_count: '7' })).toBe(7);
    expect(scriptLineCount({ script_line_count: -1 })).toBe(0);
    expect(scriptLineCount({ script_line_count: 2.5 })).toBe(0);
    expect(scriptLineCount({})).toBe(0);
    expect(scriptLineCount(null)).toBe(0);
  });
});

describe('approvedBeatCount', () => {
  test('counted from the locked beats when the episode carries them', () => {
    expect(approvedBeatCount({ script_locked_beats: [1, 2, 3] })).toBe(3);
    expect(approvedBeatCount({ script_locked_beats: JSON.stringify([1, 2]) })).toBe(2);
    expect(approvedBeatCount({ script_locked_beats: [], script_approved_beat_count: 9 })).toBe(0);
    expect(approvedBeatCount({ script_locked_beats: [1, 1, 99] })).toBe(approvedBeats({ script_locked_beats: [1, 1, 99] }).size);
  });

  test('without them, the server\'s script_approved_beat_count, never more than the 14 beats', () => {
    expect(approvedBeatCount({ script_approved_beat_count: 5 })).toBe(5);
    expect(approvedBeatCount({ script_locked_beats: null, script_approved_beat_count: 14 })).toBe(14);
    expect(approvedBeatCount({ script_approved_beat_count: 40 })).toBe(14);
    expect(approvedBeatCount({ script_approved_beat_count: -2 })).toBe(0);
    expect(approvedBeatCount({})).toBe(0);
    expect(approvedBeatCount()).toBe(0);
  });

  test('the fact alone: null when the episode carries none', () => {
    expect(approvedBeatCountFact({ script_approved_beat_count: 0 })).toBe(0);
    expect(approvedBeatCountFact({ script_approved_beat_count: 3 })).toBe(3);
    expect(approvedBeatCountFact({})).toBeNull();
    expect(approvedBeatCountFact({ script_approved_beat_count: 'x' })).toBeNull();
    expect(approvedBeatCountFact(null)).toBeNull();
  });
});
