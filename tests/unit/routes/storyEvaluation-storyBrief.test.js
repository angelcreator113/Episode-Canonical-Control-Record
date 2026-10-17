// Storyteller scenes read the Character Story Brief (stage A), and the
// blind spot goes in as dramatic irony only when the scene asks for it.

jest.mock('../../../src/models', () => ({}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({})));
const routes = require('../../../src/routes/storyEvaluationRoutes');

const MAREN = {
  character_key: 'maren', display_name: 'Maren',
  mask_persona: 'Effortless', truth_persona: 'Afraid to be seen unfinished',
  wound: { description: 'The shop that closed' }, triggers: ['An unfinished room'],
  change_capacity: { mobility: 'highly_rigid', conditions_for_change: 'someone stays' },
  blind_spot: 'She keeps score',
};

test('the character block carries the brief, marked private, and change capacity from its record', () => {
  const block = routes.buildCharacterBlock(MAREN, []);
  expect(block).toContain('PRIVATE AUTHOR TRUTH');
  expect(block).toContain('- Who they are underneath: Afraid to be seen unfinished');
  expect(block).toContain('- What gets to them: An unfinished room');
  expect(block).toContain('- How far they can change: highly rigid; would change if someone stays');
  expect(block).not.toContain('She keeps score');
});

test('the blind spot reaches the voices only when the scene asks for it', () => {
  const base = { scene_brief: 'A fitting', voice_key: 'voice_a', characters_in_scene: ['maren'], charBlocks: '', dossiers: [MAREN] };
  expect(routes.buildGenerationPrompt(base)).not.toContain('She keeps score');
  const asked = routes.buildGenerationPrompt({ ...base, dramatic_irony: true });
  expect(asked).toContain('DRAMATIC IRONY');
  expect(asked).toContain('Cannot see: She keeps score');
});
