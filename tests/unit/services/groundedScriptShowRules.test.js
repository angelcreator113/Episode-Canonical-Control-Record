// ============================================================================
// Two show rules in the Script tab's writer (Evoni, 2026-10-17): Lala talks
// only after her voice icon is clicked (unless she answers a notification or
// message, or is being dressed), and beat 5 shows the invitation letter,
// never the login screen. The writer is told; what it misses is fixed after
// writing, approved beats left as they are. No database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader } = require('../../../src/utils/canonicalScriptBeats');

const PHONE = [
  { id: 'homepage', name: 'Homepage', category: 'phone', is_home: true, screen_links: [{ label: 'Lala Voice Icon', target: 'homepage', persistent: true }] },
  { id: 'InviteLetterOverlay', name: 'Invitation', category: 'phone' },
];
const body = (n) => (n === 4 ? 'Me: ooh\nLala: hi' : n === 5 ? '[UI:DISPLAY Start button]\nMe: read it' : 'Me: hi');
const FULL = CANONICAL_BEATS.map((b) => `${beatHeader(b)}\n${body(b.number)}`).join('\n\n');
const models = () => ({
  EpisodeBrief: { findOne: async () => null },
  ScenePlan: { findAll: async () => [] },
  SceneSet: {},
  sequelize: { query: async () => [[]] },
});
function mockAnthropic(create) {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
}

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.doMock('../../../src/services/episodeScriptWriterService', () => ({
    ...jest.requireActual('../../../src/services/episodeScriptWriterService'),
    loadScriptContext: async () => null,
  }));
  jest.doMock('../../../src/services/phoneOverlays', () => ({ overlayStatusForShow: async () => PHONE }));
});
afterEach(() => jest.restoreAllMocks());

test("the writer is told both rules, by the show's own names", async () => {
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  mockAnthropic(create);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  await generateGroundedScript('ep1', 'show-1', models());
  const prompt = create.mock.calls[0][0].messages[0].content;
  expect(prompt).toContain('Beat 5 (Reveal): the invitation letter comes up, [UI:OPEN Invitation], never the login screen or the Start button');
  expect(prompt).toContain('Lala talks only after JustAWoman clicks her voice icon: [UI:CLICK Lala Voice Icon] on its own line right before every line Lala says: one click, one line');
  expect(prompt).toContain('the line where she answers a notification or message');
  expect(prompt).toContain('while she is being dressed');
});

test('what the writer misses is fixed after writing', async () => {
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  mockAnthropic(create);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  const out = await generateGroundedScript('ep1', 'show-1', models());
  expect(out.script).toContain(`${beatHeader(CANONICAL_BEATS[3])}\nMe: ooh\n[UI:CLICK Lala Voice Icon]\nLala: hi`);
  expect(out.script).toContain(`${beatHeader(CANONICAL_BEATS[4])}\n[UI:OPEN Invitation]\nMe: read it`);
  expect(out.script).not.toContain('Start button');
  expect(out.coverage.voice_clicks).toBe(1);
  expect(out.coverage.reveal_fixed).toBe(true);
});

test('approved beats keep their words', async () => {
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  mockAnthropic(create);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  const lockedBeats = [4, 5].map((n) => ({ number: n, text: `${beatHeader(CANONICAL_BEATS[n - 1])}\n${body(n)}` }));
  const out = await generateGroundedScript('ep1', 'show-1', models(), { lockedBeats });
  expect(out.script).toContain(`${beatHeader(CANONICAL_BEATS[3])}\nMe: ooh\nLala: hi`);
  expect(out.script).toContain(`${beatHeader(CANONICAL_BEATS[4])}\n[UI:DISPLAY Start button]`);
  expect(out.coverage.voice_clicks).toBe(0);
  expect(out.coverage.reveal_fixed).toBe(false);
});
