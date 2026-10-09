import { describe, test, expect } from 'vitest';
import { splitSections, moveBeat, moveLine, dropIndex, insertLine } from './scriptBeatOrder';

const SCRIPT = '[EVENT: name="Gala"]\n\n## BEAT: 1 · Opening Ritual\nPrime: one\n\n(beat)\n\n## BEAT: 2 · Login Sequence\nLala: two\n\n## BEAT: 3 · Welcome\nLala: a\nLala: b\nLala: c\n';

describe('scriptBeatOrder', () => {
  test('splits the text before the first beat from the beats', () => {
    const { preamble, sections } = splitSections(SCRIPT);
    expect(preamble).toBe('[EVENT: name="Gala"]');
    expect(sections.map((s) => s.split('\n')[0])).toEqual(['## BEAT: 1 · Opening Ritual', '## BEAT: 2 · Login Sequence', '## BEAT: 3 · Welcome']);
  });

  test('a moved beat keeps its header, and the other beats keep their text exactly', () => {
    expect(moveBeat(SCRIPT, 2, 0)).toBe('[EVENT: name="Gala"]\n\n## BEAT: 3 · Welcome\nLala: a\nLala: b\nLala: c\n\n## BEAT: 1 · Opening Ritual\nPrime: one\n\n(beat)\n\n## BEAT: 2 · Login Sequence\nLala: two');
  });

  test('a move that goes nowhere leaves the script as it is', () => {
    expect(moveBeat(SCRIPT, 1, 1)).toBe(SCRIPT);
    expect(moveBeat(SCRIPT, 0, 7)).toBe(SCRIPT);
    expect(moveLine(SCRIPT, 2, 0, 0)).toBe(SCRIPT);
    expect(moveLine(SCRIPT, 9, 0, 1)).toBe(SCRIPT);
  });

  test('a line moves inside its own beat', () => {
    expect(moveLine(SCRIPT, 2, 2, 0)).toBe('[EVENT: name="Gala"]\n\n## BEAT: 1 · Opening Ritual\nPrime: one\n\n(beat)\n\n## BEAT: 2 · Login Sequence\nLala: two\n\n## BEAT: 3 · Welcome\nLala: c\nLala: a\nLala: b');
  });

  test('dropping before or after a target', () => {
    expect(dropIndex(0, 2, false)).toBe(1);
    expect(dropIndex(0, 2, true)).toBe(2);
    expect(dropIndex(3, 1, false)).toBe(1);
    expect(dropIndex(3, 1, true)).toBe(2);
  });

  test('insertLine puts a line after another in its beat, first with -1, last past the end (Task #2793)', () => {
    const script = '[EVENT: x]\n\n## BEAT: 1 · A\nLala: one\n\nLala: two\n\n## BEAT: 2 · B\nMe: three';
    expect(insertLine(script, 0, 0, '[UI:DISPLAY lower_third]')).toBe('[EVENT: x]\n\n## BEAT: 1 · A\nLala: one\n[UI:DISPLAY lower_third]\nLala: two\n\n## BEAT: 2 · B\nMe: three');
    expect(insertLine(script, 0, -1, 'X')).toContain('## BEAT: 1 · A\nX\nLala: one');
    expect(insertLine(script, 1, 9, 'X')).toContain('## BEAT: 2 · B\nMe: three\nX');
    expect(insertLine(script, 5, 0, 'X')).toBe(script);
    expect(insertLine(script, 0, 0, '  ')).toBe(script);
  });
});
