// ============================================================================
// The Script tab's writer and beat 14's opportunity (Evoni, 2026-10-19): the
// prompt carries it, and a beat 14 that leaves it out is written again. No
// database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader } = require('../../../src/utils/canonicalScriptBeats');

const OPP = { name: 'Sable Campaign Shoot', opportunity_type: 'campaign', contact_name: 'Sable Reyes', connector_handle: 'sablereyes' };
const FULL = CANONICAL_BEATS.map((b) => `${beatHeader(b)}\nMe: hi`).join('\n\n');
const models = () => ({
  EpisodeBrief: { findOne: async () => null },
  ScenePlan: { findAll: async () => [] },
  SceneSet: {},
  sequelize: { query: async () => [[]] },
});

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
  jest.doMock('../../../src/services/scriptMoneyContext', () => ({ loadScriptMoney: async () => null }));
  jest.doMock('../../../src/services/beat14Opportunity', () => ({
    ...jest.requireActual('../../../src/services/beat14Opportunity'),
    loadForScript: async () => OPP,
  }));
});
afterEach(() => jest.restoreAllMocks());

test('the prompt carries the invitation, and a beat 14 without it is written again with it', async () => {
  const fixed = `${beatHeader(CANONICAL_BEATS[13])}\n[UI:DM Sable Reyes: The Sable campaign shoot is yours if you want it.]`;
  const create = jest.fn(async (call) => ({
    content: [{ text: call.messages[0].content.includes('Write ONLY beat 14 again') ? fixed : FULL }],
  }));
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  const out = await generateGroundedScript('ep1', 'show-1', models());
  const prompt = create.mock.calls[0][0].messages[0].content;
  expect(prompt).toContain('═══ BEAT 14 OPPORTUNITY ═══');
  expect(prompt).toContain('Sable Campaign Shoot (campaign): offered by Sable Reyes (@sablereyes)');
  const ask = create.mock.calls.map((c) => c[0].messages[0].content).find((p) => p.includes('Write ONLY beat 14 again'));
  expect(ask).toContain('End on the invitation from Sable Reyes');
  expect(out.coverage.fixed_beats).toContain(14);
  expect(out.script).toContain('The Sable campaign shoot is yours');
});
