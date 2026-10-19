// ============================================================================
// The Script tab's writer, second pass (Script page re-audit, 2026-10-19):
// the free fixes run before the paid fix pass, so a beat 8 that lacks only a
// coin line is not rewritten; the prompt says one thing for the cutscene,
// Lala speaks where her beats need her, beat 12 is the runway walk, and the
// coin, invitation, stats and career wording agree. No database, no network.
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

describe('the free fixes come before the paid fix pass', () => {
  const MONEY = { balanceBefore: 1900, look: [{ id: 'jacket-1', name: 'Jacket', amount: 120 }], recap: [], covered: [], income: [], shopping: null };
  const body = (n) => {
    if (n === 8) return '[UI:OPEN Closet]\n[UI:CLICK Voice Icon]\nLala: this one\n[WEAR: jacket-1]';
    if (n === 12) return 'Lala: I walk the runway\n[STAT: reputation +1]\n[STAT: brand_trust +1]\n[STAT: influence +1]\n[STAT: stress -1]\nMe: wow';
    if (n === 13) return 'Lala: done\nMe: ok';
    if (n === 11) return 'Me: hey\nLala: hi';
    return 'Me: hi\n[UI:OPEN Home]';
  };
  const FULL = CANONICAL_BEATS.map((b) => `${beatHeader(b)}\n${body(b.number)}`).join('\n\n');
  const models = () => ({ EpisodeBrief: { findOne: async () => null }, ScenePlan: { findAll: async () => [] }, SceneSet: {}, sequelize: { query: async () => [[]] } });

  test('a beat 8 missing only a coin line gets it with no AI call, its dialogue kept', async () => {
    jest.doMock('../../../src/services/episodeScriptWriterService', () => ({ ...jest.requireActual('../../../src/services/episodeScriptWriterService'), loadScriptContext: async () => null }));
    jest.doMock('../../../src/services/phoneOverlays', () => ({ overlayStatusForShow: async () => [] }));
    jest.doMock('../../../src/services/scriptMoneyContext', () => ({ loadScriptMoney: async () => MONEY }));
    jest.doMock('../../../src/services/uiOverlayService', () => ({ getAllOverlayTypes: async () => [] }));
    const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
    const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
    Anthropic.default = Anthropic;
    jest.doMock('@anthropic-ai/sdk', () => Anthropic);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    const out = await generateGroundedScript('ep1', 'show-1', models());
    expect(create).toHaveBeenCalledTimes(1);
    expect(out.coverage.fixed_beats).toEqual([]);
    expect(out.coverage.coin_lines).toBe(1);
    expect(out.script).toContain('Lala: this one\n[WEAR: jacket-1]\n[STAT: coins -120]');
  });
});

describe('the prompt', () => {
  const { buildScriptPrompt } = require('../../../src/services/groundedScriptGeneratorService');
  const EVENT = { id: 'e1', name: 'Sable Gala', prestige: 7, cost_coins: 120, invitation_asset_id: 'x' };
  const ON = [{ name: 'Voice Icon', category: 'phone_icon' }, { name: 'Invitation Letter', category: 'production' }, { name: 'Stats Panel', category: 'production' }];
  const inputs = (over = {}) => ({
    brief: { forward_hook: '', designed_intent: 'pass' }, scenePlan: [], franchiseLaws: [], eventData: EVENT, wardrobeItems: [], lalaStats: null,
    outfitScore: null, seasonContext: null, onScreen: ON, story: null, phone: null, worldNow: '', money: null, beat14: null, ...over,
  });
  const speaks = (prompt, n) => {
    const at = prompt.indexOf(beatHeader(CANONICAL_BEATS[n - 1]));
    return prompt.slice(at).match(/Lala speaks: (true|false)/)[1];
  };

  test('Lala speaks in beats 3, 10 and 14; beats 1 and 9 stay JustAWoman\'s', () => {
    const p = buildScriptPrompt(inputs());
    expect(speaks(p, 3)).toBe('true');
    expect(speaks(p, 10)).toBe('true');
    expect(speaks(p, 14)).toBe('true');
    expect(speaks(p, 1)).toBe('false');
    expect(speaks(p, 9)).toBe('false');
  });

  test('UI actions become [UI:] lines in the gameplay beats only; the cutscene stages them', () => {
    const p = buildScriptPrompt(inputs());
    expect(p).toContain('In the gameplay beats (1–10 and 14), turn each beat\'s "UI action" above into one or more of these lines');
    expect(p).toContain('In the cutscene (11–13) the UI action is staged in (actions), and its only [UI:] lines are the overlays on the video');
    expect(p).not.toMatch(/\nTurn each beat's "UI action"/);
  });

  test('JustAWoman plays in 1–10 and 14 and clicks nothing in the cutscene', () => {
    const p = buildScriptPrompt(inputs());
    expect(p).toContain('Drives all decisions in the gameplay beats');
    expect(p).toContain('in the cutscene (beats 11–13) she watches, comments and clicks nothing');
    expect(p).not.toContain('beats 1–12');
  });

  test('without LALA\'S COINS, the entry cost is the one coin line and the format says where it comes from', () => {
    const p = buildScriptPrompt(inputs());
    expect(p).toContain('Cost: 120 coins, which comes off in the Recap Panel (Beat 13) only, as [STAT: coins -120]');
    expect(p).toContain('[STAT: coins -X] (a cost, only where the EVENT block puts one;');
    expect(p).not.toContain("only where LALA'S COINS puts one");
    const withMoney = buildScriptPrompt(inputs({ money: { balanceBefore: 100, look: [], recap: [], covered: [], income: [], shopping: null } }));
    expect(withMoney).toContain("[STAT: coins -X] (a cost, only where LALA'S COINS puts one;");
  });

  test('the invitation comes up by the show rule\'s own line, never InviteLetterOverlay', () => {
    const p = buildScriptPrompt(inputs());
    expect(p).not.toContain('InviteLetterOverlay');
    expect(p).toContain('reads the invitation aloud as it comes up on screen, [UI:DISPLAY Invitation Letter].');
  });

  test('beat 12 is the runway walk in the story layers; beat 14\'s second message is the invitation when it comes', () => {
    const opp = { name: 'Velvet Editorial', opportunity_type: 'editorial', status: 'held', contact_name: 'Ivy Lane' };
    const p = buildScriptPrompt(inputs({ beat14: opp }));
    expect(p).toContain('event outcome (11) → runway walk (12).');
    expect(p).not.toContain('deliverable (12)');
    expect(p).toContain('a second at beat 14 is the invitation (BEAT 14 OPPORTUNITY), and only that');
    expect(buildScriptPrompt(inputs({ beat14: opp, brief: { designed_intent: 'fail' } }))).toContain('a second at beat 14 optional');
  });

  test('her balance is said as it stands; what she owes is content that never costs her', () => {
    const story = {
      career: { deal: null, deliverables: [{ description: 'TikTok outfit reveal', required: true, owed_to: 'brand', fee: 100 }], goals: [] },
      characterState: { coins: 420, reputation: 6, brand_trust: 5, influence: 4, stress: 6 },
    };
    const p = buildScriptPrompt(inputs({ story }));
    expect(p).toContain('When she checks her balance, use the exact number as it stands at that point');
    expect(p).not.toContain('Use the exact coin number in Lala\'s internal monologue');
    expect(p).toContain('WHAT SHE OWES (content she makes for the deal; none of it costs her coins):');
    expect(p).toContain('- TikTok outfit reveal (owed to the brand, pays her 100 coins, next episode)');
  });

  test('beats 11 and 13 no longer say her stats or coins move there in general', () => {
    const purpose = (n) => CANONICAL_BEATS.find((b) => b.number === n).narrative_purpose;
    expect(purpose(11)).not.toMatch(/Stats update/);
    expect(purpose(13)).not.toMatch(/Coins changed/);
    expect(purpose(13)).toContain("The event's own costs come off");
  });
});
