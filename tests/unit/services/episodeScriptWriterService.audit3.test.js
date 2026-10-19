// ============================================================================
// The old Script Writer page's writer follows the show rules (Script page
// audit 3, 2026-10-19): it saved its script to the episode with a
// "[STAT: coins +50]" example, no cutscene, no voice clicks and no beat 14
// opportunity. Its prompt now reads the grounded writer's own blocks, its
// call tries twice and stops on a refused budget, and its text gets the same
// free fixes before it is saved. No database, no network.
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

const OPP = { id: 'o1', name: 'Velour Spring Campaign', opportunity_type: 'campaign', status: 'held', contact_name: 'Mira', connector_handle: 'mira' };
const context = (over = {}) => ({
  brief: { forward_hook: 'A rival calls', designed_intent: 'pass' }, scenePlan: [], event: { id: 'e1', name: 'Velour Gala', cost_coins: 150 },
  financial: null, wardrobe: [], franchiseLaws: [], worldState: null, worldNow: '',
  career: { deal: { kind: 'deal', payer: 'Velour', terms: ['Paid to appear'], bonus: null }, deliverables: [], goals: [] },
  beat14: OPP, onScreen: [{ name: 'Voice Icon', category: 'phone_icon' }], phone: null, money: null, ...over,
});

describe('its prompt', () => {
  test('no + coin example; the show rules, JustAWoman on camera and the screen lines come from the grounded writer', () => {
    const grounded = require('../../../src/services/groundedScriptGeneratorService');
    const { buildFullPrompt } = require('../../../src/services/episodeScriptWriterService');
    const ctx = context();
    const p = buildFullPrompt(ctx);
    expect(p).not.toMatch(/\[STAT: coins \+/);
    expect(p).toContain(grounded.showRulesBlock({ eventData: ctx.event, phone: null, onScreen: ctx.onScreen }));
    expect(p).toContain(grounded.justAWomanOnCamera());
    expect(p).toContain(grounded.screenLinesText());
    expect(p).toContain('[UI:CLICK Voice Icon]');
  });

  test('beat 14 ends on the attached opportunity, and the career block leaves beat 14 to it', () => {
    const { buildFullPrompt } = require('../../../src/services/episodeScriptWriterService');
    const p = buildFullPrompt(context());
    expect(p).toContain('═══ BEAT 14 OPPORTUNITY ═══');
    expect(p).toContain('Beat 14 ends on the invitation in the BEAT 14 OPPORTUNITY block; the forward hook, "A rival calls", is told through it');
    expect(p).not.toContain('a follow-up offer');
    expect(p).not.toContain('End Beat 14 with a forward hook that seeds the next episode');
  });

  test('withheld (designed to fail), no offer comes', () => {
    const { buildFullPrompt } = require('../../../src/services/episodeScriptWriterService');
    const p = buildFullPrompt(context({ brief: { forward_hook: '', designed_intent: 'fail' } }));
    expect(p).toContain('the BEAT 14 OPPORTUNITY does not come, and no other offer comes in its place');
    expect(p).toContain('no offer comes: a goal still open, or what she does now');
  });

  test('who speaks in each beat is the grounded writer\'s: Lala in 3, 10, 13 and 14', () => {
    const { buildFullPrompt } = require('../../../src/services/episodeScriptWriterService');
    const plan = CANONICAL_BEATS.map((b) => ({ beat_number: b.number, beat_name: b.name }));
    const p = buildFullPrompt(context({ scenePlan: plan }));
    for (const n of [3, 10, 13, 14]) {
      const at = p.indexOf(`BEAT ${n}: ${CANONICAL_BEATS[n - 1].name}`);
      expect(p.slice(at).match(/LALA SPEAKS: (true|false)/)[1]).toBe('true');
    }
  });
});

describe('its call', () => {
  const load = (create) => {
    const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
    Anthropic.default = Anthropic;
    jest.doMock('@anthropic-ai/sdk', () => Anthropic);
    return require('../../../src/services/episodeScriptWriterService');
  };

  test('tries twice', async () => {
    const create = jest.fn().mockRejectedValueOnce(new Error('overloaded')).mockResolvedValueOnce({ content: [{ text: '[]' }], usage: {} });
    const { writeScriptReply } = load(create);
    const out = await writeScriptReply('prompt');
    expect(create).toHaveBeenCalledTimes(2);
    expect(out.model).toBe('claude-sonnet-4-6');
  });

  test('a refused budget is not tried again', async () => {
    const create = jest.fn().mockRejectedValue(Object.assign(new Error('budget'), { code: 'AI_BUDGET_EXCEEDED', status: 429 }));
    const { writeScriptReply } = load(create);
    await expect(writeScriptReply('prompt')).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('its text', () => {
  test('is written under the Script tab\'s beat headers', () => {
    const { renderScriptText } = require('../../../src/services/episodeScriptWriterService');
    const text = renderScriptText([{ beat_number: 11, beat_name: 'The Event', lines: [{ speaker: 'Lala', type: 'dialogue', text: 'hi' }] }]);
    expect(text).toBe(`${beatHeader(CANONICAL_BEATS[10])}\nLala: hi`);
  });

  test('gets the free fixes before it is saved: voice clicks, no phone in the cutscene, no + coins', () => {
    const { scriptTextAfterFixes } = require('../../../src/services/episodeScriptWriterService');
    const text = [
      `${beatHeader(CANONICAL_BEATS[2])}\nMe: hi besties\nLala: hey bestie`,
      `${beatHeader(CANONICAL_BEATS[10])}\nMira: welcome\n[UI:CLICK Voice Icon]\nLala: hi`,
      `${beatHeader(CANONICAL_BEATS[12])}\nLala: wow\n[STAT: coins +50]`,
    ].join('\n\n');
    const out = scriptTextAfterFixes(text, context());
    expect(out).toContain(`${beatHeader(CANONICAL_BEATS[2])}\nMe: hi besties\n[UI:CLICK Voice Icon]\nLala: hey bestie`);
    expect(out).toContain(`${beatHeader(CANONICAL_BEATS[10])}\nMira: welcome\nLala: hi`);
    expect(out).not.toContain('coins +50');
  });
});
