import { describe, test, expect } from 'vitest';
import { lineSeconds, beatSeconds, scriptSeconds, formatRuntime } from './scriptRuntime';

describe('lineSeconds', () => {
  test('dialogue is its spoken words at 150 a minute; the label and quotes are not words', () => {
    // 5 words: 2 seconds.
    expect(lineSeconds('Lala: "Hi besties, welcome back home."')).toBeCloseTo(2);
    expect(lineSeconds('Me: one two three four five')).toBeCloseTo(2);
    // An aside inside the line is acted, not spoken.
    expect(lineSeconds('Lala: (softly) "one two three four five"')).toBeCloseTo(2);
  });

  test('an action or narration line is 3s, a moment on screen 2s', () => {
    expect(lineSeconds('(She opens the closet)')).toBe(3);
    expect(lineSeconds('The room goes quiet.')).toBe(3);
    expect(lineSeconds('[UI:OPEN closet]')).toBe(2);
  });

  test('hidden tags are 0, a transition 1s', () => {
    for (const t of ['[STAT: coins +50]', '[MAIL: invite]', '[WEAR: w-1]', '[DELIVER: d-1]', '[TODO_MODE: deal]', '[SCENE: x]', '[LOCATION_HINT: x]', '[EVENT: name="Gala"]']) {
      expect(lineSeconds(t)).toBe(0);
    }
    expect(lineSeconds('[TRANSITION: fade to the gala]')).toBe(1);
    expect(lineSeconds('')).toBe(0);
    expect(lineSeconds(null)).toBe(0);
  });
});

describe('beatSeconds and scriptSeconds', () => {
  const lines = ['Lala: one two three four five', '(She twirls)', '[UI:OPEN closet]', '[STAT: coins +5]', '[TRANSITION: cut]'];
  test('a beat adds its lines, to whole seconds', () => {
    expect(beatSeconds(lines)).toBe(2 + 3 + 2 + 0 + 1);
    expect(beatSeconds([])).toBe(0);
    expect(beatSeconds(undefined)).toBe(0);
  });
  test('the script adds its beats', () => {
    expect(scriptSeconds([{ lines }, { lines: ['(Beat)'] }])).toBe(11);
    expect(scriptSeconds([])).toBe(0);
  });
});

describe('formatRuntime', () => {
  test('seconds under a minute, then minutes and seconds', () => {
    expect(formatRuntime(0)).toBe('~0s');
    expect(formatRuntime(45)).toBe('~45s');
    expect(formatRuntime(130)).toBe('~2m 10s');
    expect(formatRuntime(570)).toBe('~9m 30s');
    expect(formatRuntime(180)).toBe('~3m');
    expect(formatRuntime(-3)).toBe('~0s');
  });
});
