// Who says a script line (Script tab re-audit, 2026-10-15): one rule for the
// tab, Rewrite line, the runtime and the export.
import { describe, test, expect } from 'vitest';
import { speakerLine, unquote } from './scriptSpeaker';

describe('speakerLine', () => {
  test('names with a note, two words or inner capitals; LALA is Lala', () => {
    expect(speakerLine('Lala (V.O.): "Hi there"')).toEqual({ speaker: 'Lala', label: 'Lala', note: '(V.O.)', prefix: 'Lala (V.O.): ', words: '"Hi there"' });
    expect(speakerLine('Mary Jane: Hi')?.speaker).toBe('Mary Jane');
    expect(speakerLine('JustAWoman: Hi')?.speaker).toBe('JustAWoman');
    expect(speakerLine('LALA: Hi')?.speaker).toBe('Lala');
    expect(speakerLine('Me: Hi')?.speaker).toBe('Prime');
  });
  test('a label is not a person, and a line with no colon has no speaker', () => {
    expect(speakerLine('Location: The penthouse')).toBeNull();
    expect(speakerLine('Note: lighting')).toBeNull();
    expect(speakerLine('She walks in.')).toBeNull();
  });
});

test('unquote takes off one pair of quotes, and leaves a quote inside', () => {
  expect(unquote('"Hello"')).toBe('Hello');
  expect(unquote('“Curly”')).toBe('Curly');
  expect(unquote('"Hello," she said.')).toBe('"Hello," she said.');
});
