// ============================================================================
// The Script tab's writer, third pass (Script page audit 3, 2026-10-19):
// - what code can mend (a wrong beat 8 coin amount, a + coin line, the phone
//   in the cutscene) is mended before the paid fix pass, so no Sonnet call
//   is spent on it;
// - a fix is judged after the free fixes run on it, so a rewrite that adds
//   the missing [WEAR:] but leaves the coin lines to code is kept;
// - the prompt: the entry cost's "Recap Panel only" goes with whether
//   LALA'S COINS is there; rule 4 is for the whole script only; FINANCIAL
//   CONTEXT's "Can afford" reads the coins left after the look; beat 3's
//   phone is the voice click only.
// No database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader } = require('../../../src/utils/canonicalScriptBeats');

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const MONEY = { balanceBefore: 1000, look: [{ id: 'w1', name: 'Gold dress', amount: 300 }, { id: 'w2', name: 'Pearl heels', amount: 100 }], recap: [{ label: 'Entry', amount: 150 }], covered: [], income: [], shopping: null };
const BODY = {
  8: '[UI:OPEN Closet]\nMe: the dress\n[WEAR: w1]\n[STAT: coins -300]\nMe: heels\n[WEAR: w2]\n[STAT: coins -100]',
  11: 'Me: here we go\nLala: hi bestie',
  12: 'Me: whoa\nLala: I walk the runway\n[STAT: reputation +1]\n[STAT: brand_trust +1]\n[STAT: influence +1]\n[STAT: stress -1]',
  13: '[UI:DISPLAY Stats Panel]\nLala: that felt amazing\nMe: wow\n[STAT: coins -150]',
};
const body = (over) => (n) => (over[n] ?? BODY[n] ?? 'Me: hi\n[UI:OPEN Home]');
const draft = (over = {}) => CANONICAL_BEATS.map((b) => `${beatHeader(b)}\n${body(over)(b.number)}`).join('\n\n');
const models = () => ({ EpisodeBrief: { findOne: async () => null }, ScenePlan: { findAll: async () => [] }, SceneSet: {}, sequelize: { query: async () => [[]] } });

function load(replies) {
  jest.doMock('../../../src/services/episodeScriptWriterService', () => ({ ...jest.requireActual('../../../src/services/episodeScriptWriterService'), loadScriptContext: async () => ({ wardrobe: [{ id: 'w1', name: 'Gold dress' }, { id: 'w2', name: 'Pearl heels' }] }) }));
  jest.doMock('../../../src/services/phoneOverlays', () => ({ overlayStatusForShow: async () => [] }));
  jest.doMock('../../../src/services/scriptMoneyContext', () => ({ loadScriptMoney: async () => MONEY }));
  jest.doMock('../../../src/services/uiOverlayService', () => ({ getAllOverlayTypes: async () => [] }));
  jest.doMock('../../../src/services/beat14Opportunity', () => ({ ...jest.requireActual('../../../src/services/beat14Opportunity'), loadForScript: async () => null }));
  const queue = [...replies];
  const create = jest.fn(async () => ({ content: [{ text: queue.shift() }], stop_reason: 'end_turn' }));
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
  return { create, ...require('../../../src/services/groundedScriptGeneratorService') };
}

describe('what code can mend costs no AI call', () => {
  test.each([
    ['a wrong beat 8 coin amount', { 8: BODY[8].replace('[STAT: coins -300]', '[STAT: coins -250]') }, (s) => expect(s).toContain('[WEAR: w1]\n[STAT: coins -300]')],
    ['a + coin line', { 13: `${BODY[13]}\n[STAT: coins +200]` }, (s) => expect(s).not.toContain('[STAT: coins +200]')],
    ['a voice click in the cutscene', { 11: 'Me: here we go\n[UI:CLICK Voice Icon]\nLala: hi bestie' }, (s) => expect(s).toContain(`${beatHeader(CANONICAL_BEATS[10])}\nMe: here we go\nLala: hi bestie`)],
  ])('%s', async (_name, over, check) => {
    const { create, generateGroundedScript } = load([draft(over)]);
    const out = await generateGroundedScript('ep1', 'show-1', models());
    expect(create).toHaveBeenCalledTimes(1);
    expect(out.coverage.fixed_beats).toEqual([]);
    check(out.script);
    expect(out.coverage.missing).toEqual([]);
  });
});

test('a fix is judged after the free fixes: the missing [WEAR:] goes in and code adds its coin lines', async () => {
  const fix = `${beatHeader(CANONICAL_BEATS[7])}\n[UI:OPEN Closet]\nMe: the dress\n[WEAR: w1]\nMe: heels\n[WEAR: w2]`;
  const { create, generateGroundedScript } = load([draft({ 8: '[UI:OPEN Closet]\nMe: the dress\n[WEAR: w1]\n[STAT: coins -300]' }), fix]);
  const out = await generateGroundedScript('ep1', 'show-1', models());
  expect(create).toHaveBeenCalledTimes(2);
  expect(out.coverage.fixed_beats).toEqual([8]);
  expect(out.script).toContain('[WEAR: w1]\n[STAT: coins -300]\nMe: heels\n[WEAR: w2]\n[STAT: coins -100]');
  expect(out.coverage.missing).toEqual([]);
});

test('one beat written again gets the same free fixes', async () => {
  const { generateGroundedBeat } = load([`${beatHeader(CANONICAL_BEATS[10])}\nMe: ooh\n[UI:CLICK Voice Icon]\nLala: hi\n[STAT: coins +50]`]);
  const beat = await generateGroundedBeat('ep1', 'show-1', models(), { beatNumber: 11, currentScript: draft() });
  expect(beat).toBe(`${beatHeader(CANONICAL_BEATS[10])}\nMe: ooh\nLala: hi`);
});

describe('the prompt', () => {
  const { buildScriptPrompt } = require('../../../src/services/groundedScriptGeneratorService');
  const EVENT = { id: 'e1', name: 'Sable Gala', prestige: 7, cost_coins: 150 };
  const inputs = (over = {}) => ({
    brief: { forward_hook: '', designed_intent: 'pass' }, scenePlan: [], franchiseLaws: [], eventData: EVENT, wardrobeItems: [], lalaStats: null,
    outfitScore: null, seasonContext: null, onScreen: [], story: null, phone: null, worldNow: '', money: null, beat14: null, ...over,
  });
  const RECAP_ONLY = 'which comes off in the Recap Panel (Beat 13) only, as [STAT: coins -150]; never earlier';

  test('with money read but no LALA\'S COINS block (no balance, no costing piece), the EVENT block keeps "Recap Panel only"', () => {
    const p = buildScriptPrompt(inputs({ money: { balanceBefore: null, look: [], recap: [], covered: [], income: [], shopping: { lines: [], total: 0 } } }));
    expect(p).not.toContain("═══ LALA'S COINS ═══");
    expect(p).toContain(RECAP_ONLY);
    expect(p).toContain('[STAT: coins -X] (a cost, only where the EVENT block puts one');
  });

  test('with LALA\'S COINS there, it says it once', () => {
    const p = buildScriptPrompt(inputs({ money: MONEY }));
    expect(p).toContain("═══ LALA'S COINS ═══");
    expect(p).not.toContain(RECAP_ONLY);
    expect(p).toContain("[STAT: coins -X] (a cost, only where LALA'S COINS puts one");
  });

  test('rule 4 (comments at least twice) is for the whole script, not one beat', () => {
    const full = buildScriptPrompt(inputs());
    const one = buildScriptPrompt(inputs(), { only: { beat: CANONICAL_BEATS[7], currentScript: '' } });
    expect(full).toContain('ask audience to react in comments at least twice');
    expect(one).not.toContain('at least twice');
  });

  test('"Can afford" reads the coins left after the look, as LALA\'S COINS does', () => {
    const story = { financial: { pressure_level: 'tight', balance: 100, total_income: 0, total_expenses: 300, event_cost: 150, can_afford: false } };
    const yes = buildScriptPrompt(inputs({ story, money: { ...MONEY, balanceBefore: 1000 } }));
    expect(yes).toContain("Lala's balance: 1000 Prime Coins");
    expect(yes).toContain('Event cost: 150 coins | Can afford: YES');
    const no = buildScriptPrompt(inputs({ story: { financial: { ...story.financial, can_afford: true } }, money: { ...MONEY, balanceBefore: 500 } }));
    expect(no).toContain('Event cost: 150 coins | Can afford: NO');
  });

  test('beat 3 is gameplay: its only phone moment is the voice click before Lala\'s line', () => {
    const p = buildScriptPrompt(inputs());
    expect(p).not.toContain('No phone moment');
    const job3 = CANONICAL_BEATS.find((b) => b.number === 3).story_job;
    expect(job3).toContain('voice click');
  });
});
