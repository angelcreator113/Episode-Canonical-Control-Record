/**
 * Spoiler terms (Evoni, 2026-10-26, ruling 5): wording that names what
 * Lala hasn't learned, or paraphrases it, is caught; everyday wording is
 * not.
 */
const { terms, privateTerms, leaks } = require('../../../src/utils/spoilerTerms');

const SECRET = privateTerms(['Participate in surprise runway opportunity', 'Maison Rue', 'The Glasshouse', 'Velour Magazine Cover Shoot']);

describe('caught', () => {
  test.each([
    ['Practice my catwalk', ['runway']],
    ['Nail the modelling bit', ['runway']],
    ['Dinner at Maison Rue', ['maison', 'rue']],
    ["Maison Rue's fitting", ['maison', 'rue']],
    ['Get to the glasshouse early', ['glasshouse']],
    ['Prep for the editorial', ['magazine']],
    ['Velour said yes!', ['velour']],
    ['RUNWAYS!!!', ['runway']],
    ['Café at Maisón', ['maison']],
  ])('%s', (text, hit) => {
    expect(leaks(text, SECRET).sort()).toEqual(hit.sort());
  });
});

describe('not caught', () => {
  test.each([
    'Find something to wear', 'Check my coins', 'Meet some interesting people', 'Get some good footage',
    'Walk in heels', 'Ring light charged', 'Sign up for the class', 'Look into that video offer', 'Film my video',
    'Get to the studio', 'Share something from the day', 'Shoot my video', 'Cover the cab fare',
  ])('%s', (text) => {
    expect(leaks(text, SECRET)).toEqual([]);
  });

  test('event words on their own are not private', () => {
    expect([...privateTerms(['The Big Launch Party Night'])]).toEqual([]);
    expect(leaks('the party', privateTerms(['Studio Party']))).toEqual([]);
  });

  test('nothing private: nothing leaks', () => {
    expect(leaks('Practice my catwalk', new Set())).toEqual([]);
  });
});

test('terms: stems and concepts', () => {
  expect([...terms("Maison Rue's catwalk models walking")]).toEqual(['maison', 'rue', 'runway', 'walk']);
});
