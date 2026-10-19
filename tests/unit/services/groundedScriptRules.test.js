// ============================================================================
// The show's rules in the writer's fix pass (utils/scriptRuleChecks.js;
// Evoni, 2026-10-17 and 2026-10-18): a beat that breaks one is written
// again with the rule asked for, never an approved beat. No database, no
// network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');

const beat = (n, ...lines) => [`## BEAT: ${n} · ${CANONICAL_BEATS[n - 1].name}`, ...lines].join('\n');
// Every rule kept but Lala's beat 13 line; phone beats have their moment.
const draft = CANONICAL_BEATS.map((c) => {
  if (c.number === 5) return beat(5, '[UI:OPEN Invitation]');
  if (c.number === 12) return beat(12, '[UI:SHOW phone]', '[STAT: reputation +2, brand_trust +1, influence +1, stress -1]', '[UI:HIDE phone]');
  if (c.number === 13) return beat(13, 'Me: what a night', '(JustAWoman watches, silent.)');
  return beat(c.number, [4, 7, 8, 9, 10].includes(c.number) ? '[UI:OPEN Mail]' : 'Me: hi');
}).join('\n\n');

function mockAnthropic(create) {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
}
const models = () => ({
  EpisodeBrief: { findOne: async () => ({}) },
  ScenePlan: { findAll: async () => [] },
  SceneSet: {},
  sequelize: { query: async () => [[]] },
});
const reply = (text) => ({ content: [{ text }] });
const asked = (create, n) => create.mock.calls.map((c) => c[0].messages[0].content).find((p) => p.includes(`Write ONLY beat ${n} again`));

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.doMock('../../../src/services/episodeScriptWriterService', () => ({
    ...jest.requireActual('../../../src/services/episodeScriptWriterService'),
    loadScriptContext: async () => null,
  }));
});
afterEach(() => jest.restoreAllMocks());

test("beat 13 without Lala's line is written again with her line asked for", async () => {
  const create = jest.fn(async (call) => (call.messages[0].content.includes('Write ONLY beat 13 again')
    ? reply(beat(13, 'Me: what a night', '[UI:CLICK Voice Icon]', 'Lala: that felt like me', '(JustAWoman watches, silent.)'))
    : reply(draft)));
  mockAnthropic(create);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  const out = await generateGroundedScript('ep1', 'show-1', models());
  expect(asked(create, 13)).toContain('- Lala says how the outcome feels, in her own words, as one spoken line (Lala: …)');
  expect(out.coverage.fixed_beats).toEqual([13]);
  expect(out.script).toContain('Lala: that felt like me');
  expect(out.coverage.missing).toEqual([]);
});

test('an approved beat 13 is never written again; what it lacks is reported', async () => {
  const create = jest.fn(async () => reply(draft));
  mockAnthropic(create);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  const lockedBeats = [{ number: 13, text: beat(13, 'Me: approved words', '(JustAWoman watches, silent.)') }];
  const out = await generateGroundedScript('ep1', 'show-1', models(), { lockedBeats });
  expect(asked(create, 13)).toBeUndefined();
  expect(out.script).toContain('Me: approved words');
  expect(out.coverage.missing).toEqual([expect.objectContaining({ kind: 'rule', rule: 'beat13', target: 13 })]);
});
