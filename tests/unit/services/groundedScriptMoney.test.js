// ============================================================================
// Lala's coins and beat 12 in the Script tab's writer (Evoni, 2026-10-18).
// The writer is told the balance before the episode (not the one after the
// posted pieces), each piece's cost and the shopping list for beat 9; the
// coin line a piece lacks goes in after writing; beat 12 is The Fashion
// Challenge, judged on her standing. No database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader } = require('../../../src/utils/canonicalScriptBeats');

const MONEY = {
  balanceBefore: 1900,
  look: [{ id: 'jacket-1', name: 'Midnight Bloom Lace Peplum Jacket', amount: 120 }],
  recap: [], covered: [{ label: 'Entry / ticket' }], income: [],
  shopping: { overlay: true, total: 120, lines: [{ label: 'Statement jacket', pieces: ['Midnight Bloom Lace Peplum Jacket'], cost: 120, owned: false, filled: true, extra: false }] },
};
const STORY = {
  financial: { pressure_level: 'comfortable', balance: 768, total_income: 0, total_expenses: 1132, financial_score: 6 },
  characterState: { coins: 768, reputation: 6, brand_trust: 5, influence: 4, stress: 3 },
};
const body = (n) => (n === 8 ? '[UI:OPEN Closet]\nLala: this one\n[WEAR: jacket-1]' : 'Me: hi');
const FULL = CANONICAL_BEATS.map((b) => `${beatHeader(b)}\n${body(b.number)}`).join('\n\n');
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
    loadScriptContext: async () => STORY,
  }));
  jest.doMock('../../../src/services/phoneOverlays', () => ({ overlayStatusForShow: async () => [] }));
  jest.doMock('../../../src/services/scriptMoneyContext', () => ({ loadScriptMoney: async () => MONEY }));
});
afterEach(() => jest.restoreAllMocks());

async function write() {
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  const out = await generateGroundedScript('ep1', 'show-1', models());
  return { out, prompt: create.mock.calls[0][0].messages[0].content };
}

test('the writer reads the balance before the episode, never the one after the posted pieces', async () => {
  const { prompt } = await write();
  expect(prompt).toContain('Lala starts this episode with 1,900 coins');
  expect(prompt).toContain("Lala's balance: 1900 Prime Coins");
  expect(prompt).not.toContain("Lala's balance: 768");
  expect(prompt).toContain('- Midnight Bloom Lace Peplum Jacket [WEAR: jacket-1]: [STAT: coins -120]');
  expect(prompt).toContain('[UI:DISPLAY Shopping list]');
  expect(prompt).toContain('its own coin line right after when it costs her');
});

test("a piece's coin line goes in after its wear cue when the writer left it out", async () => {
  const { out } = await write();
  expect(out.script).toContain('[WEAR: jacket-1]\n[STAT: coins -120]');
  expect(out.coverage.coin_lines).toBe(1);
});

test('beat 12 is The Fashion Challenge, judged on her standing, and the old name still reads as beat 12', async () => {
  const { prompt } = await write();
  expect(prompt).toContain('## BEAT: 12 · Fashion Challenge');
  expect(prompt).toContain('Beat 12 (Fashion Challenge): someone at the event sets Lala a styling challenge');
  expect(prompt).toContain('[STAT: reputation ±n], [STAT: brand_trust ±n], [STAT: influence ±n] and [STAT: stress ±n] lines, never coins');
  const { beatNumberForLabel } = require('../../../src/utils/beatLabelNumber');
  expect(beatNumberForLabel('Deliverable Creation')).toBe(12);
  expect(beatNumberForLabel('THE FASHION CHALLENGE')).toBe(12);
});
