// ============================================================================
// JustAWoman on camera (Evoni, 2026-10-17): she plays the game from her
// corner and reacts to what she has seen, with performance, player actions
// and optional sound and edit cues; Lala lives it and cannot hear her. No
// database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader } = require('../../../src/utils/canonicalScriptBeats');

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.doMock('../../../src/services/episodeScriptWriterService', () => ({
    ...jest.requireActual('../../../src/services/episodeScriptWriterService'),
    loadScriptContext: async () => null,
  }));
  jest.doMock('../../../src/services/phoneOverlays', () => ({ overlayStatusForShow: async () => [] }));
});
afterEach(() => jest.restoreAllMocks());

test('the writer is told how JustAWoman plays on camera', async () => {
  const FULL = CANONICAL_BEATS.map((b) => `${beatHeader(b)}\nMe: hi`).join('\n\n');
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  await generateGroundedScript('ep1', 'show-1', {
    EpisodeBrief: { findOne: async () => null },
    ScenePlan: { findAll: async () => [] },
    SceneSet: {},
    sequelize: { query: async () => [[]] },
  });
  const prompt = create.mock.calls[0][0].messages[0].content;
  expect(prompt).toContain('═══ JUSTAWOMAN ON CAMERA ═══');
  expect(prompt).toContain('Lala cannot hear her commentary or see the audience\'s game interface');
  expect(prompt).toContain('never an interchangeable line like "This is exciting!"');
  expect(prompt).toContain('Only to what she has actually seen');
  expect(prompt).toContain('[SFX: notification ping], [EDIT: punch-in on her corner frame]');
  expect(prompt).toContain('While playing (beats 1–12)');
  expect(prompt).toContain('While reviewing (beats 13–14)');
  expect(prompt).toContain('(JustAWoman watches, silent.)');
  expect(prompt).toContain('never invents viewer messages or comments');
  expect(prompt).toContain('never invent a past grudge or favorite');
  expect(prompt).toContain('[SFX: sound] / [EDIT: editing cue]');
  // The old "react to everything" rules are gone.
  expect(prompt).not.toContain('celebrates everything');
  expect(prompt).not.toContain('reacts to everything in real time');
});
