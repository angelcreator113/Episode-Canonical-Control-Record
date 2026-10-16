// ============================================================================
// The Script tab's writer says one thing once (Script tab re-audit,
// 2026-10-15): one coin number, one season, one closing hook; stats rules
// that agree; a one-beat rewrite is not told to write 14 beats; a story
// block that fails to render costs only that block. No database, no network.
// ============================================================================

const story = (over = {}) => ({
  career: {
    deal: { kind: 'paid', payer: 'Studio Sable', terms: ['300 coins to appear'], bonus: null },
    deliverables: [{ description: 'TikTok outfit reveal', required: true }],
    goals: [{ label: 'Meet Marcus Reed' }],
  },
  financial: { pressure_level: 'tight', balance: 420, total_income: 0, total_expenses: 80, financial_score: 6 },
  characterState: { coins: 999, reputation: 6, brand_trust: 5, influence: 4, stress: 6 },
  arcPhase: { name: 'Rise', current_phase: 2, phase_title: 'The Climb', emotional_temperature: 'warm' },
  socialProfiles: [{ handle: 'marcusreed', display_name: 'Marcus Reed', platform: 'instagram' }],
  worldState: { character_states: { lala: { coins: 1 } } },
  franchiseLaws: [{ title: 'Story rule', category: 'voice', content: '{"summary":"keep it real"}' }],
  wardrobe: [],
  event: null,
  ...over,
});

function mockAnthropic(create) {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
}
const SEASON = { label: 'Episode 3 of 10', phase: { number: 2, title: 'The Climb' } };
const models = ({ season = null } = {}) => ({
  EpisodeBrief: { findOne: async () => ({ forward_hook: 'and then the DM arrives' }) },
  ScenePlan: { findAll: async () => [] },
  SceneSet: {},
  sequelize: { query: async (sql) => (/season_context/.test(sql) && season ? [[{ season_context: season }]] : [[]]) },
});
const loaded = (s) => jest.doMock('../../../src/services/episodeScriptWriterService', () => ({
  ...jest.requireActual('../../../src/services/episodeScriptWriterService'),
  loadScriptContext: jest.fn(async () => s),
}));

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader } = require('../../../src/utils/canonicalScriptBeats');
const FULL = CANONICAL_BEATS.map((b) => `${beatHeader(b)}\nMe: hi`).join('\n\n');

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const promptFor = async (s, opts) => {
  loaded(s);
  const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
  mockAnthropic(create);
  const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
  await generateGroundedScript('ep1', 'show-1', models(opts));
  return create.mock.calls[0][0].messages[0].content;
};

describe("the Script tab's writer prompt", () => {
  test("one coin number: the ledger's, in her stats too; no cut world-state JSON", async () => {
    const prompt = await promptFor(story());
    expect(prompt).toContain("Lala's balance: 420 Prime Coins");
    expect(prompt).toContain('🪙 420 coins');
    expect(prompt).not.toContain('999');
    expect(prompt).not.toContain("═══ LALA'S STATE ═══");
  });

  test('one season: the arc block is left out when the episode has its season position', async () => {
    const prompt = await promptFor(story(), { season: SEASON });
    expect(prompt).toContain('Season position: Episode 3 of 10, Phase 2: The Climb');
    expect(prompt).not.toContain('═══ SEASON ARC ═══');
  });

  test('without a season position, the arc block stays', async () => {
    expect(await promptFor(story())).toContain('═══ SEASON ARC ═══');
  });

  test("one hook: the brief's, in rule 6 and in the career block's beat 14", async () => {
    const prompt = await promptFor(story());
    expect(prompt).toContain('6. Beat 14 ends on the forward hook: "and then the DM arrives"');
    expect(prompt).toContain('- Beat 14: end on the forward hook, "and then the DM arrives", told through her career');
    expect(prompt).not.toContain('- Beat 14: the hook comes from her career');
  });

  test('the stats rule lets her say her balance', async () => {
    const prompt = await promptFor(story());
    expect(prompt).toContain('5. A change to her stats appears only as a [STAT:] tag; she may say her coin balance in her own words');
    expect(prompt).not.toContain('5. Stats only appear as [STAT:] tags');
  });

  test('guests at the event have a line format', async () => {
    expect(await promptFor(story())).toContain('Another character at the event speaks as their name: [their words]');
  });

  test('the Show Brain rules come from the story read, not a second read', async () => {
    expect(await promptFor(story())).toContain('Story rule: keep it real');
  });

  test('a story block that fails to render leaves only itself out', async () => {
    // Re-audit 2 (2026-10-15): one guest's bad JSON dropped her career, money and stats too.
    const prompt = await promptFor(story({ socialProfiles: [{ handle: 'x', platform: 'ig', depth_level: 'active', core_wound: 'old', therapy_emotional_state: '{not json' }] }));
    expect(prompt).toContain('═══ SCENE PLAN — 14 BEATS ═══');
    expect(prompt).toContain("═══ LALA'S CAREER IN THIS EPISODE ═══");
    expect(prompt).toContain('═══ FINANCIAL CONTEXT ═══');
    expect(prompt).toContain("═══ LALA'S STATS ═══");
    expect(prompt).not.toContain('═══ CHARACTERS AT THE EVENT ═══');
    expect(prompt).toContain("7. Lala's career is on the page");
    expect(console.error).toHaveBeenCalledWith('[ScriptGen] story block "story" failed (non-blocking):', expect.any(String));
  });

  test('a hook with $ in it is written as it is', async () => {
    loaded(story());
    const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
    mockAnthropic(create);
    const m = models();
    m.EpisodeBrief.findOne = async () => ({ forward_hook: "Lala's $$ problem and the $& deal" });
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    await generateGroundedScript('ep1', 'show-1', m);
    expect(create.mock.calls[0][0].messages[0].content).toContain(`- Beat 14: end on the forward hook, "Lala's $$ problem and the $& deal", told through her career`);
  });

  test('without her stats row, the world snapshot gives the ledger balance', async () => {
    const prompt = await promptFor(story({ characterState: null }));
    expect(prompt).toContain("═══ LALA'S STATE ═══");
    expect(prompt).toContain('{"lala":{"coins":420}}');
  });

  test('a one-beat rewrite is told about one beat, and the hook only for beat 14', async () => {
    loaded(story());
    const create = jest.fn(async () => ({ content: [{ text: `${beatHeader(CANONICAL_BEATS[2])}\nMe: hi` }] }));
    mockAnthropic(create);
    const { generateGroundedBeat } = require('../../../src/services/groundedScriptGeneratorService');
    await generateGroundedBeat('ep1', 'show-1', models(), { beatNumber: 3, currentScript: FULL });
    const prompt = create.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('Each of the 14 beats opens with its header line');
    expect(prompt).not.toContain('ends on the forward hook');
    expect(prompt).toContain('The beat opens with its header line (given under THIS TASK)');
  });
});

describe('loadScriptContext lite', () => {
  test('skips the wardrobe intelligence', async () => {
    const intel = jest.fn(async () => ({}));
    jest.doMock('../../../src/services/wardrobeIntelligenceService', () => ({ getWardrobeIntelligence: intel }));
    const { loadScriptContext } = require('../../../src/services/episodeScriptWriterService');
    const m = {
      EpisodeBrief: { findOne: async () => null },
      ScenePlan: { findAll: async () => [] },
      SceneSet: {},
      sequelize: { query: async (sql) => (/FROM world_events/.test(sql) ? [[{ id: 'ev', name: 'Gala' }]] : /episode_wardrobe/.test(sql) ? [[{ id: 'w1', name: 'Dress' }]] : [[]]) },
    };
    await loadScriptContext('ep1', 'show-1', m, { lite: true });
    expect(intel).not.toHaveBeenCalled();
  });
});
