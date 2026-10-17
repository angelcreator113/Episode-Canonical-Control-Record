'use strict';

/**
 * Cross-character checks, the pure parts: sentences (a decimal like "1.2M"
 * stays whole) and the wording that puts a poster at an event.
 */
const { sentencesOf, PRESENCE_RE } = require('../../../src/services/castCrossCheck');

describe('sentencesOf', () => {
  test('splits on a full stop followed by a space or a line break, never inside "1.2M"', () => {
    expect(sentencesOf('Her rival Kai has 1.2M followers. Nia went dark!\nNew line here'))
      .toEqual(['Her rival Kai has 1.2M followers.', 'Nia went dark!', 'New line here']);
  });
});

describe('PRESENCE_RE', () => {
  test.each([
    ["I'm at the Linen Gala", true],
    ['we were at the gala all night', true],
    ['here at the gala and it is everything', true],
    ['last night at the gala was a lot', true],
    ['the gala looked like a mess', false],
    ['gala tonight at 8, who is going', false],
  ])('%s', (text, placed) => {
    expect(PRESENCE_RE.test(text)).toBe(placed);
  });
});
