/**
 * The episode short-story writer follows canon (docs/CANON.md; Evoni,
 * 2026-10-15): Lala does not know she was built or that JustAWoman exists;
 * JustAWoman (the player) never appears in Lala's story; the LalaVerse's
 * social app is The Pulse, never a real app; and a short story gives beat 11
 * its moment.
 */
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: jest.fn() } }; });
const { CANON_RULES, FORMAT_SPECS } = require('../../../src/services/storyGenerationService');

test('every format is told who Lala is and who stays out of her world', () => {
  for (const format of Object.keys(FORMAT_SPECS)) {
    const rules = CANON_RULES(format);
    expect(rules).toMatch(/Lala does not know she was built/);
    expect(rules).toMatch(/JustAWoman \(the player and host\) is outside Lala's world/);
    expect(rules).toMatch(/ONE social app: The Pulse/);
  }
});

test('in-world formats stay in the world; the recap may name the show', () => {
  expect(CANON_RULES('short_story')).toMatch(/Stay in the world: nothing about a show/);
  expect(CANON_RULES('recap')).toMatch(/may name the show/);
  expect(CANON_RULES('recap')).not.toMatch(/Stay in the world/);
});

test('only the short story is asked for the beat 11 moment', () => {
  expect(CANON_RULES('short_story')).toMatch(/beat 11 \(The Event\)/);
  expect(CANON_RULES('snippet')).not.toMatch(/beat 11/);
});

test('no format asks for a real app', () => {
  const specs = JSON.stringify(FORMAT_SPECS);
  expect(specs).not.toMatch(/\bIG\b|Instagram|TikTok|Substack/);
  expect(specs).toMatch(/The Pulse/);
});

test('the prompt carries the rules', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', '..', 'src', 'services', 'storyGenerationService.js'), 'utf8');
  expect(src).toMatch(/FRANCHISE RULES:\n- Lala is the protagonist[^\n]*\n\$\{CANON_RULES\(format\)\}/);
});
