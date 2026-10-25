// The server's speaker rule is the Script tab's (frontend/src/lib/scriptSpeaker.js):
// the same cases, read on the server for character voices that learn.
const { speakerLine, isHerSpeaker, shownSpeaker, scriptCast, unquote } = require('../../../src/utils/scriptSpeaker');

describe('speakerLine (server mirror)', () => {
  test.each([
    ['Me: hi besties', 'Prime', 'Me'],
    ['Prime: welcome back', 'Prime', 'Prime'],
    ['JustAWoman: okay okay', 'JustAWoman', 'JustAWoman'],
    ['Lala (V.O.): bestie, look', 'Lala', 'Lala'],
    ['**Lala:** bold line', 'Lala', 'Lala'],
    ['Mary Jane: hello there', 'Mary Jane', 'Mary Jane'],
    ['lala: lower case', 'Lala', 'lala'],
    ['Émile: bonjour', 'Émile', 'Émile'],
  ])('%s is spoken by %s', (line, speaker, label) => {
    const sp = speakerLine(line);
    expect(sp).toMatchObject({ speaker, label });
  });

  test.each([
    'Location: the closet',
    'Note: keep it short',
    'Suddenly: the lights go out.',
    'Marcus walks in: and everyone turns to look',
    '[UI:CLICK Voice Icon]',
    '(she laughs)',
  ])('%s has no speaker', (line) => {
    expect(speakerLine(line)).toBeNull();
  });

  test("a cast member's name in lower case is theirs only when the cast names them", () => {
    expect(speakerLine('marcus: hey')).toBeNull();
    expect(speakerLine('marcus: hey', { cast: scriptCast(['Marcus: hi']) })).toMatchObject({ speaker: 'Marcus' });
  });

  test('her names are all JustAWoman', () => {
    for (const n of ['Me', 'prime', 'JustAWoman', 'JAWIHP']) expect(isHerSpeaker(n)).toBe(true);
    expect(isHerSpeaker('Lala')).toBe(false);
    expect(shownSpeaker('Me')).toBe('JustAWoman');
  });

  test('unquote drops one pair of quotes', () => {
    expect(unquote('"Hi, bestie."')).toBe('Hi, bestie.');
    expect(unquote('“Hi”')).toBe('Hi');
    expect(unquote('She said "no"')).toBe('She said "no"');
  });
});
