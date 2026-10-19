// ============================================================================
// The grounded writer after the Script page audit (2026-10-19): one
// regenerated beat gets the fixes the whole script gets (the closet beat's
// coin lines, Lala's voice click); a refused budget is not tried again; the
// prompt says the show as it is now (a cost as a minus, the canonical back
// half, the entry cost in the recap, owed not required on screen); a failed
// read is logged. No database, no network.
// ============================================================================

const MONEY = {
  balanceBefore: 1900,
  look: [{ id: 'jacket-1', name: 'Jacket', amount: 120 }],
  recap: [], covered: [], income: [], shopping: null,
};
const STORY = {
  financial: { pressure_level: 'comfortable', balance: 1900, total_income: 0, total_expenses: 0, financial_score: 6 },
  career: { deal: { payer: 'Maison', terms: ['500 coins'] }, deliverables: [{ description: 'Two posts' }], goals: [{ label: 'Meet the editor' }] },
};
const models = (over = {}) => ({
  EpisodeBrief: { findOne: async () => null },
  ScenePlan: { findAll: async () => [] },
  SceneSet: {},
  sequelize: { query: async () => [[]] },
  ...over,
});

let money = MONEY;
beforeEach(() => {
  jest.resetModules();
  money = MONEY;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.doMock('../../../src/services/phoneOverlays', () => ({ overlayStatusForShow: async () => [] }));
  jest.doMock('../../../src/services/scriptMoneyContext', () => ({ loadScriptMoney: async () => money }));
});
afterEach(() => jest.restoreAllMocks());

function withReply(create) {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
  return require('../../../src/services/groundedScriptGeneratorService');
}

describe('generateGroundedBeat runs the fixes after writing', () => {
  test('the closet beat gets its coin line and the voice click', async () => {
    const create = jest.fn(async () => ({ content: [{ text: '## BEAT: 8 · Transformation Loop\n[UI:OPEN Closet]\n[WEAR: jacket-1]\nMe: next\nLala: done, bestie' }] }));
    const { generateGroundedBeat } = withReply(create);
    const beat = await generateGroundedBeat('ep1', 'show-1', models(), { beatNumber: 8, currentScript: '## BEAT: 7 · Interruption Pulse 2\nMe: seven' });
    expect(beat).toContain('[WEAR: jacket-1]\n[STAT: coins -120]');
    // The closet is open, so her line in it needs no click.
    expect(beat).not.toContain('[UI:CLICK');
  });

  test('another beat with a wear cue is not charged; in the cutscene her line gets no click', async () => {
    const create = jest.fn(async () => ({ content: [{ text: '## BEAT: 12 · Fashion Challenge\n[UI:OPEN Closet]\n[WEAR: jacket-1]\n[UI:CLOSE Closet]\nMe: wow\nLala: the room is mine' }] }));
    const { generateGroundedBeat } = withReply(create);
    const beat = await generateGroundedBeat('ep1', 'show-1', models(), { beatNumber: 12, currentScript: '## BEAT: 8 · Transformation Loop\n[UI:OPEN Closet]\n[WEAR: jacket-1]' });
    expect(beat).not.toContain('[STAT: coins');
    // Beats 11-13 are the cutscene (Evoni, 2026-10-19).
    expect(beat).not.toContain('[UI:CLICK');
  });

  test('beat 14, gameplay again, gets the click', async () => {
    const create = jest.fn(async () => ({ content: [{ text: '## BEAT: 14 · Cliffhanger\nMe: wait\nLala: who is that' }] }));
    const { generateGroundedBeat } = withReply(create);
    const beat = await generateGroundedBeat('ep1', 'show-1', models(), { beatNumber: 14, currentScript: '' });
    expect(beat).toContain('[UI:CLICK Voice Icon]\nLala: who is that');
  });

  test('beat 5 gets the invitation letter', async () => {
    const create = jest.fn(async () => ({ content: [{ text: '## BEAT: 5 · Reveal\n[UI:NOTIFY Mail: You are invited!]\nMe: read it' }] }));
    const { generateGroundedBeat } = withReply(create);
    const beat = await generateGroundedBeat('ep1', 'show-1', models(), { beatNumber: 5, currentScript: '' });
    expect(beat).toContain('[UI:OPEN Invitation]');
  });
});

describe('a refused budget is not tried again', () => {
  test('one call, and the refusal is thrown as it is', async () => {
    const err = Object.assign(new Error('AI daily budget exceeded'), { status: 429, code: 'AI_BUDGET_EXCEEDED' });
    const create = jest.fn(async () => { throw err; });
    const { generateGroundedBeat } = withReply(create);
    await expect(generateGroundedBeat('ep1', 'show-1', models(), { beatNumber: 3, currentScript: '' })).rejects.toBe(err);
    expect(create).toHaveBeenCalledTimes(1);
  });
  test('any other failure is tried a second time', async () => {
    const create = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('overloaded'), { status: 529 }))
      .mockResolvedValueOnce({ content: [{ text: '## BEAT: 3 · Welcome\nMe: hi' }] });
    const { generateGroundedBeat } = withReply(create);
    await generateGroundedBeat('ep1', 'show-1', models(), { beatNumber: 3, currentScript: '' });
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe('the prompt says the show as it is now', () => {
  const { buildScriptPrompt } = require('../../../src/services/groundedScriptGeneratorService');
  const inputs = (over = {}) => ({
    brief: null, scenePlan: [], franchiseLaws: [], wardrobeItems: [], lalaStats: null, outfitScore: null,
    eventData: { name: 'Gala', prestige: 7, cost_coins: 150, rewards: { outcomes: ['A seat at the table'] } },
    ...over,
  });

  test('a coin line is a cost, written with a minus', () => {
    const prompt = buildScriptPrompt(inputs());
    expect(prompt).not.toContain('[STAT: coins +X]');
    expect(prompt).toContain('[STAT: coins -X]');
  });

  test('the back half is named by the canonical beats, not "Result/Aftermath"', () => {
    const prompt = buildScriptPrompt(inputs());
    expect(prompt).not.toContain('Result/Aftermath');
    expect(prompt).toContain('(Beats 9-13: Reminder/Deadline, Event Travel, Event Outcome, Fashion Challenge, Recap Panel)');
  });

  test('without a money block, the entry cost comes off in the recap', () => {
    expect(buildScriptPrompt(inputs())).toContain('Cost: 150 coins, which comes off in the Recap Panel (Beat 13) only, as [STAT: coins -150]; never earlier');
    expect(buildScriptPrompt(inputs({ money: MONEY }))).toContain('Cost: 150 coins\n');
  });

  test('rule 7 does not ask for what she owes on screen', () => {
    const prompt = buildScriptPrompt(inputs({ story: STORY }));
    expect(prompt).toContain("7. Lala's career is on the page");
    expect(prompt).not.toContain('name the deal, what she owes');
    expect(prompt).toContain('the content she owes need not be shown on screen');
  });
});

describe('every failed read is logged', () => {
  test('the brief and the scene plan', async () => {
    const create = jest.fn(async () => ({ content: [{ text: '## BEAT: 3 · Welcome\nMe: hi' }] }));
    const { generateGroundedBeat } = withReply(create);
    await generateGroundedBeat('ep1', 'show-1', models({
      EpisodeBrief: { findOne: async () => { throw new Error('brief down'); } },
      ScenePlan: { findAll: async () => { throw new Error('plan down'); } },
    }), { beatNumber: 3, currentScript: '' });
    expect(console.error).toHaveBeenCalledWith('[ScriptGen] brief read failed (non-blocking):', 'brief down');
    expect(console.error).toHaveBeenCalledWith('[ScriptGen] scene plan read failed (non-blocking):', 'plan down');
  });
});
