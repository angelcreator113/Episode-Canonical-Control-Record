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

// One ending for beat 14 (Script page audit, 2026-10-19): with the invitation
// coming it ends on it and the hook is told through it; withheld, no offer
// comes; the career block never asks for a follow-up offer beside it.
describe('one instruction for how beat 14 ends', () => {
  const CAREER = { career: { deal: { kind: 'paid', payer: 'Studio Sable', terms: ['300 coins'], bonus: null }, deliverables: [], goals: [{ label: 'Meet Marcus Reed' }] } };
  const promptWith = async ({ opp = OPP, intent = 'pass', hook = 'and then the DM arrives' } = {}) => {
    jest.doMock('../../../src/services/episodeScriptWriterService', () => ({
      ...jest.requireActual('../../../src/services/episodeScriptWriterService'),
      loadScriptContext: async () => CAREER,
    }));
    jest.doMock('../../../src/services/beat14Opportunity', () => ({
      ...jest.requireActual('../../../src/services/beat14Opportunity'),
      loadForScript: async () => opp,
    }));
    const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
    const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
    Anthropic.default = Anthropic;
    jest.doMock('@anthropic-ai/sdk', () => Anthropic);
    const m = { ...models(), EpisodeBrief: { findOne: async () => ({ forward_hook: hook, designed_intent: intent }) } };
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    await generateGroundedScript('ep1', 'show-1', m);
    return create.mock.calls[0][0].messages[0].content;
  };

  test('with the invitation coming: rule 6 ends on it, the hook told through it; no follow-up offer', async () => {
    const prompt = await promptWith();
    expect(prompt).toContain('6. Beat 14 ends on the invitation in the BEAT 14 OPPORTUNITY block; the forward hook, "and then the DM arrives", is told through it');
    expect(prompt).not.toContain('6. Beat 14 ends on the forward hook');
    expect(prompt).not.toMatch(/^- Beat 14: .*follow-up offer/m);
    expect(prompt).toContain("═══ LALA'S CAREER IN THIS EPISODE ═══");
  });

  test('designed to fail: no offer comes, and the career block asks for none', async () => {
    const prompt = await promptWith({ intent: 'fail' });
    expect(prompt).toContain('6. Beat 14 ends on the forward hook: "and then the DM arrives"; the BEAT 14 OPPORTUNITY does not come, and no other offer comes in its place');
    expect(prompt).toContain('- Beat 14: end on the forward hook, "and then the DM arrives", told through her career: no offer comes');
    expect(prompt).not.toContain('follow-up offer');
  });

  test('expired at completion reads as not coming; offered as coming', async () => {
    expect(await promptWith({ opp: { ...OPP, status: 'expired' } })).toContain('the BEAT 14 OPPORTUNITY does not come');
    jest.resetModules();
    expect(await promptWith({ opp: { ...OPP, status: 'offered' }, intent: 'fail' })).toContain('6. Beat 14 ends on the invitation');
  });

  test('nothing attached: as before', async () => {
    const prompt = await promptWith({ opp: null });
    expect(prompt).toContain('6. Beat 14 ends on the forward hook: "and then the DM arrives"\n');
    expect(prompt).toContain('- Beat 14: end on the forward hook, "and then the DM arrives", told through her career: a follow-up offer');
  });
});
