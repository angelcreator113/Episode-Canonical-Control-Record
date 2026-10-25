// Who says a script line (Script tab re-audit, 2026-10-15): one rule for the
// tab, Rewrite line, the runtime and the export.
import { describe, test, expect } from 'vitest';
import { speakerLine, unquote, scriptCast, shownSpeaker, isHerSpeaker, HER } from './scriptSpeaker';

describe('speakerLine', () => {
  test('names with a note, two words or inner capitals; LALA is Lala', () => {
    expect(speakerLine('Lala (V.O.): "Hi there"')).toEqual({ speaker: 'Lala', label: 'Lala', note: '(V.O.)', prefix: 'Lala (V.O.): ', words: '"Hi there"', auto: false });
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

test('a capital in any language starts a name (re-audit 2)', () => {
  expect(speakerLine('Émile: oui')?.speaker).toBe('Émile');
});


// Script tab audit 6 (2026-10-24): `me:` and `lala:` in lower case are
// speakers; any other lower-case name only when the cast has it.
describe('lower-case labels', () => {
  test("the show's people and her names, in any case", () => {
    expect(speakerLine('me: hi')).toMatchObject({ speaker: 'Prime', label: 'me', words: 'hi' });
    expect(speakerLine('lala (softly): hi')).toMatchObject({ speaker: 'Lala', note: '(softly)' });
    expect(speakerLine('jawihp: the whole truth of it all')?.speaker).toBe('jawihp');
  });
  test('the cast by its own spelling; anything else stays narration', () => {
    expect(speakerLine('marcus hale: hi', { cast: ['Marcus Hale'] })?.speaker).toBe('Marcus Hale');
    expect(speakerLine('marcus: hi')).toBeNull();
    expect(speakerLine('then: the lights go out')).toBeNull();
    expect(speakerLine('note: lighting', { cast: ['Note'] })).toBeNull();
  });
  test('scriptCast: the capitalised speakers that are not hers or the show\'s', () => {
    expect([...scriptCast(['Marcus: hi', 'Me: yes', 'Lala: ok', 'Suddenly: dark', 'Dana Hale (V.O.): there'])]).toEqual(['Marcus', 'Dana Hale']);
  });
  test('her names, one list: Me, Prime, JustAWoman, JAWIHP', () => {
    expect(['Me', 'prime', 'JustAWoman', 'JAWIHP'].map(shownSpeaker)).toEqual([HER, HER, HER, HER]);
    expect(isHerSpeaker('Lala')).toBe(false);
    expect(shownSpeaker('Lala')).toBe('Lala');
  });
});
