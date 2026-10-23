// ============================================================================
// The script writers read the season twists (services/seasonTwists,
// 2026-10-23): loadScriptContext loads the episode's twist block,
// storyContextBlocks puts it in when there is one, and the Script tab's
// grounded writer sends it in its prompt. No database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader } = require('../../../src/utils/canonicalScriptBeats');

const BLOCK = '═══ SEASON TWISTS ═══\nPLANT (subtly; do not explain): The ring — Maren is not wearing it\nSCRIPT DIRECTIVE: a plant is a detail the audience can notice and nobody explains.\n';
const FULL = CANONICAL_BEATS.map((b) => `${beatHeader(b)}\nMe: hi`).join('\n\n');
const models = () => ({
  EpisodeBrief: { findOne: async () => null },
  ScenePlan: { findAll: async () => [] },
  SceneSet: {},
  sequelize: { query: async () => [[]], QueryTypes: { SELECT: 'SELECT' } },
});

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('storyContextBlocks puts the twist block in only when there is one', () => {
  const { storyContextBlocks } = require('../../../src/services/episodeScriptWriterService');
  expect(storyContextBlocks({ twistBlock: BLOCK })).toContain(BLOCK.trim());
  expect(storyContextBlocks({ twistBlock: BLOCK }, { withSeason: false })).toContain('PLANT (subtly; do not explain): The ring');
  expect(storyContextBlocks({ twistBlock: '' })).not.toContain('SEASON TWISTS');
  expect(storyContextBlocks({})).not.toContain('SEASON TWISTS');
});

test("loadScriptContext reads the episode's twists", async () => {
  const twistBlock = jest.fn(async () => BLOCK);
  jest.doMock('../../../src/services/seasonTwists', () => ({ twistBlock }));
  const { loadScriptContext } = require('../../../src/services/episodeScriptWriterService');
  const m = { ...models(), SceneAngle: {}, FranchiseKnowledge: { findAll: async () => [] }, WorldEvent: { findOne: async () => null }, WorldLocation: {} };
  const context = await loadScriptContext('ep-1', 'show-1', m, { lite: true });
  expect(twistBlock).toHaveBeenCalledWith(m.sequelize, 'ep-1');
  expect(context.twistBlock).toBe(BLOCK);
});

test('loadScriptContext goes without twists when they cannot be read', async () => {
  jest.doMock('../../../src/services/seasonTwists', () => ({ twistBlock: async () => { throw new Error('boom'); } }));
  const { loadScriptContext } = require('../../../src/services/episodeScriptWriterService');
  const m = { ...models(), SceneAngle: {}, FranchiseKnowledge: { findAll: async () => [] }, WorldEvent: { findOne: async () => null }, WorldLocation: {} };
  const context = await loadScriptContext('ep-1', 'show-1', m, { lite: true });
  expect(context.twistBlock).toBe('');
});

test("the Script tab's writer is told what to plant", async () => {
  jest.doMock('../../../src/services/episodeScriptWriterService', () => ({
    ...jest.requireActual('../../../src/services/episodeScriptWriterService'),
    loadScriptContext: async () => ({ twistBlock: BLOCK }),
  }));
  jest.doMock('../../../src/services/phoneOverlays', () => ({ overlayStatusForShow: async () => [] }));
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  await generateGroundedScript('ep1', 'show-1', models());
  const prompt = create.mock.calls[0][0].messages[0].content;
  expect(prompt).toContain('═══ SEASON TWISTS ═══\nPLANT (subtly; do not explain): The ring — Maren is not wearing it');
});
