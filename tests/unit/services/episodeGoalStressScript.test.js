// ============================================================================
// Her goal in the script, and her stress and self-talk in her voice (Evoni,
// 2026-10-25: "Yes build the goals and stress script work"). The episode's
// main goal is the first active goal pinned to its event
// (scriptCareerService.loadEpisodeGoal, the interim adapter); both writers
// get HER GOAL THIS EPISODE and HER VOICE through storyContextBlocks. No
// database, no network, no AI call.
// ============================================================================

const { loadEpisodeGoal } = require('../../../src/services/scriptCareerService');
const { describeGoal, progressOf, howClose, herGoalBlock, herVoiceBlock, stressVoice } = require('../../../src/services/episodeMainGoal');
const { storyContextBlocks, buildFullPrompt } = require('../../../src/services/episodeScriptWriterService');
const { buildScriptPrompt } = require('../../../src/services/groundedScriptGeneratorService');

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const GOALS = [
  { id: 'g-brand', title: 'Brand Girl Era', status: 'active', target_metric: 'brand_trust', current_value: 4, target_value: 7, starting_value: 1, priority: 1, unlocks_on_complete: [{ type: 'opportunity', name: 'Luxury brand sampling invite' }] },
  { id: 'g-brand-2', title: 'Brand Muse', status: 'active', target_metric: 'brand_trust', current_value: 4, target_value: 9, priority: 2, unlocks_on_complete: [] },
  { id: 'g-coins', title: 'Starter Fund', status: 'active', target_metric: 'coins', current_value: 300, target_value: 500, priority: 1, unlocks_on_complete: [] },
];
// What loadEpisodeGoal reads: the show's active goals only, as the SQL does.
const db = (rows) => {
  const calls = [];
  return {
    calls,
    QueryTypes: { SELECT: 'SELECT' },
    query: jest.fn(async (sql, opts) => { calls.push({ sql, opts }); return rows.filter((g) => g.status === 'active'); }),
  };
};
const pinned = (...ids) => ({ id: 'ev-1', name: 'Velour Gala', canon_consequences: { pinned_goal_ids: ids } });

describe('main goal selection (interim adapter)', () => {
  test("the first pinned goal that is active is the episode's main goal, with its next rung", async () => {
    const g = await loadEpisodeGoal(db(GOALS), { showId: 's1', event: pinned('g-brand', 'g-coins'), state: { brand_trust: 5 } });
    expect(g).toMatchObject({ id: 'g-brand', title: 'Brand Girl Era', kind: 'main', metric: 'brand_trust', current: 5, target: 7 });
    expect(g.next).toEqual({ id: 'g-brand-2', title: 'Brand Muse', target: 9 });
    expect(g.how_close).toBe('more than halfway');
  });

  test('a pinned goal already completed is skipped for the next pinned active one', async () => {
    const rows = [{ ...GOALS[0], status: 'completed' }, GOALS[2]];
    const g = await loadEpisodeGoal(db(rows), { showId: 's1', event: pinned('g-brand', 'g-coins'), state: { coins: 400 } });
    expect(g).toMatchObject({ id: 'g-coins', kind: 'main', current: 400, target: 500 });
  });

  test('nothing pinned, or no event: no goal, and no query', async () => {
    const d = db(GOALS);
    expect(await loadEpisodeGoal(d, { showId: 's1', event: { id: 'ev', canon_consequences: {} } })).toBeNull();
    expect(await loadEpisodeGoal(d, { showId: 's1', event: null })).toBeNull();
    expect(d.query).not.toHaveBeenCalled();
    // Pinned ids that name no active goal: none either.
    expect(await loadEpisodeGoal(db(GOALS), { showId: 's1', event: pinned('gone') })).toBeNull();
  });

  test('a pin given as a JSON string still reads', async () => {
    const g = await loadEpisodeGoal(db(GOALS), { showId: 's1', event: { id: 'ev', canon_consequences: JSON.stringify({ pinned_goal_ids: ['g-coins'] }) } });
    expect(g.id).toBe('g-coins');
  });
});

describe('describing the goal', () => {
  test('progress runs from its start to its target; stress counts down', () => {
    expect(progressOf({ target_metric: 'coins', target_value: 500, starting_value: 0 }, 250)).toBe(0.5);
    expect(progressOf({ target_metric: 'coins', target_value: 500 }, 600)).toBe(1);
    expect(progressOf({ target_metric: 'stress', target_value: 3, starting_value: 9 }, 6)).toBe(0.5);
    expect(progressOf({ target_metric: 'stress', target_value: 3 }, 2)).toBe(1);
    expect([0, 0.3, 0.5, 0.8, 1, null].map(howClose)).toEqual(['just starting', 'on her way', 'more than halfway', 'nearly there', 'reached', 'progress not measured']);
  });

  test('with no higher rung, what reaching it opens', () => {
    const g = describeGoal(GOALS[0], [GOALS[0]], {}, 'main');
    expect(g.next).toBeNull();
    expect(g.opens).toBe('Luxury brand sampling invite');
  });
});

describe('the prompt blocks', () => {
  const goal = describeGoal(GOALS[0], GOALS, { brand_trust: 5 }, 'main');

  test('HER GOAL THIS EPISODE: the goal, how close, the next rung, Beat 6 weighs it and Beat 13 feels it, never numbers', () => {
    const b = herGoalBlock(goal);
    expect(b).toContain('═══ HER GOAL THIS EPISODE ═══');
    expect(b).toContain('Brand Girl Era (brand trust 5 → 7, more than halfway)');
    expect(b).toContain('Evoni pinned this event to it');
    expect(b).toContain('Next rung after it: Brand Muse.');
    expect(b).toMatch(/Beat 6 \(Strategic Reaction\): Lala weighs this episode against Brand Girl Era in her own words/);
    expect(b).toMatch(/Beat 13 \(Recap Panel\): she feels where the night leaves her on it/);
    expect(b).toMatch(/Felt, never stated: no numbers/);
    expect(herGoalBlock(null)).toBe('');
  });

  test('HER VOICE: her stress band, and the self-talk tone overriding Beat 13', () => {
    expect(stressVoice(2)).toMatch(/^Playful and sure/);
    expect(stressVoice(5)).toMatch(/^Sharper: .*doubting inner voice/);
    expect(stressVoice(8)).toMatch(/^Spiralling: .*can't afford another flop/);
    const calm = herVoiceBlock({ stress: 3, tone: 'kind' });
    expect(calm).toContain('Her stress (3/10)');
    expect(calm).toContain('Playful and sure');
    expect(calm).toContain('Beat 13 (Recap Panel) self-talk: Kind');
    expect(calm).toContain("This tone overrides Beat 13's usual reflection tone.");
    expect(calm).toMatch(/Stats are felt, never stated/);
    expect(herVoiceBlock({ stress: 7, tone: 'hard' })).toContain('self-talk: Hard on herself');
    // No choice saved: Honest. No stats: no stress line, the tone still.
    const none = herVoiceBlock({});
    expect(none).toContain('self-talk: Honest');
    expect(none).not.toContain('Her stress (');
  });

  const ctx = {
    characterState: { coins: 900, reputation: 4, brand_trust: 5, influence: 3, stress: 8 },
    herGoal: goal,
    selfTalkTone: 'kind',
  };

  test('storyContextBlocks (both writers) puts them after LALA\'S STATS', () => {
    const text = storyContextBlocks(ctx);
    const stats = text.indexOf("═══ LALA'S STATS ═══");
    expect(stats).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('═══ HER VOICE ═══')).toBeGreaterThan(stats);
    expect(text.indexOf('═══ HER GOAL THIS EPISODE ═══')).toBeGreaterThan(stats);
    expect(text).toContain('Spiralling');
    expect(text).toContain('self-talk: Kind');
  });

  test("the old Script Writer's prompt has her goal, her stress voice and her tone", () => {
    const p = buildFullPrompt({
      brief: { forward_hook: '', designed_intent: 'pass' }, scenePlan: [], event: { id: 'e1', name: 'Velour Gala', cost_coins: 0 },
      financial: null, wardrobe: [], franchiseLaws: [], worldState: null, worldNow: '', career: null, beat14: null, onScreen: [], phone: null, money: null,
      ...ctx,
    });
    expect(p).toContain('═══ HER GOAL THIS EPISODE ═══');
    expect(p).toContain('Brand Girl Era');
    expect(p).toContain('Her stress (8/10)');
    expect(p).toContain('self-talk: Kind');
  });

  test("the Script tab's writer's prompt has them too", () => {
    const p = buildScriptPrompt({
      brief: null, scenePlan: [], franchiseLaws: [], wardrobeItems: [], lalaStats: null, outfitScore: null,
      eventData: { name: 'Velour Gala', cost_coins: 0 }, story: { socialProfiles: [], ...ctx },
    });
    expect(p).toContain('═══ HER GOAL THIS EPISODE ═══');
    expect(p).toContain('Beat 6 (Strategic Reaction): Lala weighs this episode against Brand Girl Era');
    expect(p).toContain('Her stress (8/10)');
    expect(p).toContain('Beat 13 (Recap Panel) self-talk: Kind');
  });

  test('no goal: no goal block; the voice block stays', () => {
    const text = storyContextBlocks({ characterState: ctx.characterState });
    expect(text).not.toContain('HER GOAL THIS EPISODE');
    expect(text).toContain('self-talk: Honest');
  });
});
