// ============================================================================
// Phone paths in the Script tab's writer (Evoni, 2026-10-16: "Beat 4:
// messages_page is on Homepage, but the phone shows closet"). The writer
// reads the phone's map, and after writing, a step goes before each tap the
// phone can't make from where it is; approved beats keep their words. No
// database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader } = require('../../../src/utils/canonicalScriptBeats');
const { phoneMapContext, phoneFromOverlays } = require('../../../src/utils/phonePaths');

const PHONE = [
  { id: 'homepage', name: 'Homepage', category: 'phone', is_home: true, screen_links: [
    { label: 'Messages Icon', target: 'messages_page' }, { label: 'Closet Icon', target: 'closet' },
  ] },
  { id: 'messages_page', name: 'Messages Page', category: 'phone' },
  { id: 'closet', name: 'closet', category: 'phone', screen_links: [{ label: 'Outfit Icon', target: 'outfit_page' }] },
  { id: 'outfit_page', name: 'Outfit Page', category: 'phone' },
  { id: 'title', name: 'Show Title', category: 'production' },
];

function mockAnthropic(create) {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
}
const models = () => ({
  EpisodeBrief: { findOne: async () => null },
  ScenePlan: { findAll: async () => [] },
  SceneSet: {},
  sequelize: { query: async () => [[]] },
});
// Every beat; beat 3 opens the closet, beats 4 and 5 tap Messages from where the last left the phone.
const body = (n) => (n === 3 ? '[UI:OPEN closet]' : n === 4 || n === 5 ? '[UI:CLICK Messages Icon]' : 'Me: hi');
const FULL = CANONICAL_BEATS.map((b) => `${beatHeader(b)}\n${body(b.number)}`).join('\n\n');

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

test('the phone map says where the phone starts, what each screen holds, and how to move', () => {
  const map = phoneMapContext(phoneFromOverlays(PHONE));
  expect(map).toContain('═══ PHONE MAP ═══');
  expect(map).toContain('The phone starts each episode on Homepage.');
  expect(map).toContain('Homepage (home screen): Messages Icon → Messages Page, Closet Icon → closet');
  expect(map).toContain('closet: Outfit Icon → Outfit Page');
  expect(map).toContain('[UI:OPEN Homepage] for the home screen');
  expect(phoneMapContext(phoneFromOverlays([]))).toBe('');
});

test("the writer reads the phone's map, and every tap it writes can happen", async () => {
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  mockAnthropic(create);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  const out = await generateGroundedScript('ep1', 'show-1', models());
  expect(create.mock.calls[0][0].messages[0].content).toContain('═══ PHONE MAP ═══');
  expect(out.coverage.phone_steps).toBe(2);
  expect(out.script).toContain(`${beatHeader(CANONICAL_BEATS[3])}\n[UI:OPEN Homepage]\n[UI:CLICK Messages Icon]`);
  expect(out.script).toContain(`${beatHeader(CANONICAL_BEATS[4])}\n[UI:OPEN Homepage]\n[UI:CLICK Messages Icon]`);
});

test('an approved beat keeps its words', async () => {
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  mockAnthropic(create);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  const lockedBeats = [{ number: 4, text: `${beatHeader(CANONICAL_BEATS[3])}\n[UI:CLICK Messages Icon]` }];
  const out = await generateGroundedScript('ep1', 'show-1', models(), { lockedBeats });
  expect(out.script).toContain(`${beatHeader(CANONICAL_BEATS[3])}\n[UI:CLICK Messages Icon]`);
  expect(out.coverage.phone_steps).toBe(1);
});

test('a phone map that fails to load leaves the script as written', async () => {
  jest.doMock('../../../src/services/phoneOverlays', () => ({ overlayStatusForShow: async () => { throw new Error('down'); } }));
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  mockAnthropic(create);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  const out = await generateGroundedScript('ep1', 'show-1', models());
  expect(create.mock.calls[0][0].messages[0].content).not.toContain('═══ PHONE MAP ═══');
  expect(out.coverage.phone_steps).toBe(0);
  expect(console.error).toHaveBeenCalledWith('[ScriptGen] phone map failed (non-blocking):', 'down');
});

// The show's rules (Evoni, 2026-10-16): the phone is up from the Start button
// to Event Travel; the invitation is read in full; pieces go on one by one.
test('the writer reads the show rules', async () => {
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  mockAnthropic(create);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  await generateGroundedScript('ep1', 'show-1', models());
  const prompt = create.mock.calls[0][0].messages[0].content;
  expect(prompt).toContain('═══ SHOW RULES ═══');
  expect(prompt).toContain("Lala's phone is on screen from the moment the Start button is clicked in Beat 1 until she travels to the event in Beat 10");
  expect(prompt).toContain('JAWIHP reads the whole invitation aloud, every word of it');
  expect(prompt).toContain('every piece of the look is picked and put on one at a time');
});
