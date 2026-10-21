// The book side check, P3 (2026-10-20): the writing assistant and the story
// evaluator call the LalaVerse social web The Pulse, never "The Feed" or
// "SOCIAL FEED", and the assistant's read of it lists LalaVerse people only
// (JustAWoman's real world is not The Pulse).
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, '../../../src/routes', p), 'utf8');

describe('The Pulse wording on the book side', () => {
  test('the writing assistant reads The Pulse, LalaVerse profiles only', () => {
    const src = read('memories/assistant.js');
    expect(src).not.toMatch(/The Feed \(/);
    expect(src).not.toMatch(/The Feed is quiet/);
    expect(src).toMatch(/The Pulse \(\$\{profiles\.length\} people\)/);
    expect(src).toMatch(/feed_layer = 'lalaverse'/);
    expect(src).toMatch(/COALESCE\(is_justawoman_record, false\) = false/);
  });

  test('the story evaluator names The Pulse only for LalaVerse profiles', () => {
    const src = read('storyEvaluationRoutes.js');
    expect(src).not.toMatch(/SOCIAL FEED CONTEXT/);
    expect(src).toMatch(/THE PULSE CONTEXT/);
    expect(src).toMatch(/'feed_layer'/);
  });
});
