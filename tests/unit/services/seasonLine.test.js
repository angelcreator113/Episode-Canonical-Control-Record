// ============================================================================
// The season line (season-AI audit, 2026-10-25): one formatter for how every
// prompt names the season and its part, and the prompts that read it. Each
// prompt builder gets the season's logline and description, its part's
// mood and real length, and goes without them when there is no season.
// No database, no network.
// ============================================================================

const {
  fromArc, fromArcContext, fromSnapshot, seasonLines, seasonLine, slotLines, partLength, loadSeasonLine, CAP,
} = require('../../../src/services/seasonLine');

const PHASES = [
  { phase: 1, title: 'Arrival', tagline: 'New city', emotional_arc: 'wonder → doubt', episode_start: 1, episode_end: 6 },
  { phase: 2, title: 'The Climb', tagline: 'Every room has a price', emotional_arc: 'hunger → rivalry → loss', episode_start: 7, episode_end: 16 },
  { phase: 3, title: 'Crown', tagline: 'Her own room', emotional_arc: 'doubt → triumph', episode_start: 17, episode_end: 24 },
];
const ARC = {
  id: 'arc-2', show_id: 'show-1', season_number: 2, title: 'Velvet Ladder', tagline: 'Up is the only way',
  logline: 'Lala moves to Velour City and learns that every invitation costs something.',
  description: 'A season about the price of access: the rooms she enters, who she leaves behind, and what she owes.',
  phases: PHASES, current_phase: 2,
};
// An episode's Start Episode snapshot (seasonSlotService.snapshotEpisode).
const SNAPSHOT = {
  season_number: 2, label: 'S2 · E9', slot_number: 9, arc_id: 'arc-2', arc_title: 'Velvet Ladder',
  arc_tagline: 'Up is the only way', arc_logline: ARC.logline, arc_description: ARC.description, phase_count: 3,
  phase: { number: 2, title: 'The Climb', tagline: 'Every room has a price', emotional_arc: 'hunger → rivalry → loss', episode_start: 7, episode_end: 16 },
  position_in_phase: 3,
  story_purposes: [{ text: 'Lala turns down her old friend for a better room', primary: true, story_thread: 'Old friends' }],
  career_focus: 'reputation', desired_pressure: 'High', outcome_range: { min: 'safe', max: 'slay' },
};

describe('the season line', () => {
  test('a season from its arc: title, tagline, logline, description and its current part with its real length', () => {
    const lines = seasonLines(fromArc(ARC));
    expect(lines).toEqual([
      'Season 2: "Velvet Ladder" — Up is the only way. Logline: Lala moves to Velour City and learns that every invitation costs something.',
      'Season description: A season about the price of access: the rooms she enters, who she leaves behind, and what she owes.',
      'Current part: Part 2 of 3, "The Climb" (E7–E16, 10 episodes) — "Every room has a price"; emotional arc: hunger → rivalry → loss',
    ]);
  });

  test('the same season from getArcContext and from a snapshot reads the same', () => {
    const ctx = {
      season: 2, arc_title: 'Velvet Ladder', arc_tagline: 'Up is the only way', arc_logline: ARC.logline, arc_description: ARC.description,
      phase_count: 3, current_phase: { number: 2, title: 'The Climb', tagline: 'Every room has a price', emotional_arc: 'hunger → rivalry → loss', episode_range: [7, 16] },
    };
    expect(seasonLine(fromArcContext(ctx))).toBe(seasonLine(fromArc(ARC)));
    expect(seasonLine(fromSnapshot(SNAPSHOT))).toBe(seasonLine(fromArc(ARC)));
  });

  test('a named part rather than the current one; options leave lines out', () => {
    const s = fromArc(ARC, { phase: 1 });
    expect(s.part.title).toBe('Arrival');
    expect(partLength(s.part)).toBe(6);
    expect(seasonLines(s, { title: false, part: false })).toEqual([
      `Season logline: ${ARC.logline}`, `Season description: ${ARC.description}`,
    ]);
    expect(seasonLines(s, { about: false, partLabel: "This episode's part" })[1]).toMatch(/^This episode's part: Part 1 of 3, "Arrival" \(E1–E6, 6 episodes\)/);
  });

  test('each text is capped', () => {
    const long = 'word '.repeat(200);
    const line = seasonLine(fromArc({ ...ARC, logline: long, description: long }));
    for (const l of line.split('\n')) expect(l.length).toBeLessThan(CAP + 150);
    expect(line).toContain('…');
  });

  test('null-safe: no season, no lines; an arc with no phases has no part; unreadable phases are logged', () => {
    expect(seasonLines(null)).toEqual([]);
    expect(seasonLine(null)).toBe('');
    expect(fromSnapshot(null)).toBeNull();
    expect(fromSnapshot({})).toBeNull();
    expect(fromArcContext(null)).toBeNull();
    expect(seasonLines(fromArc({ season_number: 3, title: 'Bare', phases: [] }))).toEqual(['Season 3: "Bare"']);
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(fromArc({ title: 'Broken', phases: '{nope' }).part).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  test("a slot's lines: purposes, focus, pressure and hoped-for outcome; none for an empty slot", () => {
    expect(slotLines(SNAPSHOT)).toEqual([
      'Slot purpose: Lala turns down her old friend for a better room (thread: Old friends)',
      'Career focus: reputation', 'Desired pressure: High', 'Hoped-for outcome: safe to slay',
    ]);
    expect(slotLines(SNAPSHOT, { purposes: 0 })).toEqual(['Career focus: reputation', 'Desired pressure: High', 'Hoped-for outcome: safe to slay']);
    expect(slotLines({ label: 'S1 · E1' })).toEqual([]);
    expect(slotLines(null)).toEqual([]);
  });

  test("loadSeasonLine: the episode's own snapshot first, else the show's active season; '' and logged on a failed read", async () => {
    const seq = (rows) => ({ query: jest.fn(async (sql) => (/FROM episodes/.test(sql) ? [[rows.episode]] : [[rows.arc].filter(Boolean)])) });
    expect(await loadSeasonLine(seq({ episode: { season_context: SNAPSHOT } }), { episodeId: 'ep-1' })).toContain("This episode's part: Part 2 of 3");
    expect(await loadSeasonLine(seq({ episode: { season_context: null, show_id: 'show-1' }, arc: ARC }), { episodeId: 'ep-1' })).toContain('Current part: Part 2 of 3');
    expect(await loadSeasonLine(seq({ arc: null }), { showId: 'show-1' })).toBe('');
    expect(await loadSeasonLine(seq({}), {})).toBe('');
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadSeasonLine({ query: async () => { throw new Error('down'); } }, { showId: 'show-1' })).toBe('');
    expect(err).toHaveBeenCalledWith(expect.stringContaining('[seasonLine]'), 'down');
    err.mockRestore();
  });
});

describe('the prompts that read it', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const grounded = (seasonContext, story = null) => require('../../../src/services/groundedScriptGeneratorService').buildScriptPrompt({
    brief: { arc_number: 2, position_in_arc: 3 }, scenePlan: [], franchiseLaws: [], eventData: null, wardrobeItems: [],
    lalaStats: null, outfitScore: null, seasonContext, story,
  });

  test("the grounded script writer: the season line, the slot's pressure and outcome, the debt, and the part's real length", () => {
    const prompt = grounded(SNAPSHOT, { arcPhase: { emotional_temperature: 'anxious', narrative_debt_summary: 'Lala carries 1 unresolved failure(s) from previous phases: She froze at the gala.' } });
    expect(prompt).toContain('Episode 3 of Part 2.');
    expect(prompt).toContain('Part: 2, Position: 3/10');
    expect(prompt).not.toContain('/8');
    expect(prompt).not.toMatch(/\bArc: 2/);
    expect(prompt).toContain('Season position: S2 · E9, Part 2: The Climb, episode 3 of 10');
    expect(prompt).toContain(`Logline: ${ARC.logline}`);
    expect(prompt).toContain(`Season description: ${ARC.description}`);
    expect(prompt).toContain("This episode's part: Part 2 of 3, \"The Climb\" (E7–E16, 10 episodes)");
    expect(prompt).toContain('emotional arc: hunger → rivalry → loss');
    expect(prompt).toContain('Desired pressure: High');
    expect(prompt).toContain('Hoped-for outcome: safe to slay');
    expect(prompt).toContain('Emotional temperature: anxious');
    expect(prompt).toContain('Narrative debt: Lala carries 1 unresolved failure(s)');
  });

  test('the grounded script writer with no season: no season lines and no made-up part length', () => {
    const prompt = grounded(null);
    expect(prompt).toContain('Part: 2, Position: 3\n');
    expect(prompt).not.toContain('Season position');
    expect(prompt).not.toContain('Logline');
  });

  test('distribution: the season and its part, from the shape the loader gives', () => {
    const { buildContextBlock } = require('../../../src/services/distributionService');
    const ctx = { show: {}, episode: { title: 'Gala', episode_number: 25 }, event: null, evaluation: null, outfitPieces: [], socialTasks: [] };
    const block = buildContextBlock({ ...ctx, arc: { ...fromSnapshot(SNAPSHOT), from_episode: true } });
    expect(block).toContain('Season 2: "Velvet Ladder" — Up is the only way. Logline:');
    expect(block).toContain("This episode's part: Part 2 of 3");
    expect(block).not.toContain('Season description');
    expect(block).not.toContain('undefined');
    expect(buildContextBlock({ ...ctx, arc: null })).not.toContain('Season');
  });

  test("the script writer's SEASON ARC block carries the logline and description", () => {
    const { storyContextBlocks } = require('../../../src/services/episodeScriptWriterService');
    const block = storyContextBlocks({ arcPhase: { name: 'Velvet Ladder', current_phase: 2, phase_title: 'The Climb', season: fromArc(ARC) } });
    expect(block).toContain('Velvet Ladder — Phase 2: The Climb\nSeason logline: Lala moves');
    expect(block).toContain('Season description: A season about the price of access');
    expect(storyContextBlocks({ arcPhase: { name: 'Old', current_phase: 1 } })).not.toContain('Season logline');
  });

  test('the season planners: proposals, twists, Draft the season and a slot draft name the logline and description', () => {
    const about = [`Season logline: ${ARC.logline}`, `Season description: ${ARC.description}`];
    const { buildPrompt } = require('../../../src/services/seasonArcProposals');
    const proposals = buildPrompt({ arc: ARC, phases: PHASES, threads: [], openSlots: [], goals: [], debt: [] }, {});
    const { suggestPrompt } = require('../../../src/services/seasonTwists');
    const twists = suggestPrompt({ arc: ARC, slots: [{ slot_number: 1 }], threads: [], characters: [], relationships: '', twists: [] });
    const { draftPrompt } = require('../../../src/services/seasonSetupService');
    const setup = draftPrompt({ arc: ARC, phases: PHASES, slots: [], targets: new Map(), threads: [], goals: [], debt: [], carried: '', partNumber: null });
    const { buildDraftPrompt } = require('../../../src/services/seasonIntentionService');
    const slot = buildDraftPrompt({ season_number: 2, slot_number: 9 }, { arc: ARC, phase: PHASES[1], earlier: [], goals: [], debt: [], threads: [] });
    for (const prompt of [proposals, twists, setup, slot]) for (const line of about) expect(prompt).toContain(line);

    // No logline or description: the prompts are as they were.
    const bare = { ...ARC, logline: null, description: null };
    expect(buildPrompt({ arc: bare, phases: PHASES, threads: [], openSlots: [], goals: [], debt: [] }, {})).not.toContain('Season logline');
    expect(buildDraftPrompt({ season_number: 2, slot_number: 9 }, { arc: null, phase: null, earlier: [], goals: [], debt: [], threads: [] }))
      .toContain('Its phase: unknown\n\nThe season so far');
  });

  test('the event concept draft: the season as background when there is one; unchanged without', () => {
    const { buildDraftPrompt } = require('../../../src/services/eventConceptDraftService');
    const line = seasonLine(fromArc(ARC), { about: false });
    const withSeason = buildDraftPrompt({ display_name: 'Maya' }, { seasonLine: line });
    expect(withSeason).toContain("Where Lala's story is now (background for the tone only; never name a season, a part or an episode):");
    expect(withSeason).toContain('Current part: Part 2 of 3, "The Climb"');
    expect(buildDraftPrompt({ display_name: 'Maya' }, {})).toBe(buildDraftPrompt({ display_name: 'Maya' }, { seasonLine: '' }));
    expect(buildDraftPrompt({ display_name: 'Maya' }, {})).not.toContain("Lala's story is now");
  });

  test('the 24-event generator names the season it is for; none without one', async () => {
    jest.resetModules();
    jest.doMock('../../../src/services/brainRules', () => ({ loadBrainContext: async () => ({ block: '', ids: [] }), recordRuleUse: async () => {} }));
    jest.doMock('../../../src/services/locationPicks', () => ({ pickLocations: async () => [] }));
    jest.doMock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
    const { buildEventPrompt } = require('../../../src/routes/eventGeneratorRoute');
    const db = (arc) => ({ sequelize: { query: async () => [[arc].filter(Boolean)] } });
    const { prompt } = await buildEventPrompt(db(ARC), 'show-1');
    expect(prompt).toContain('THE SEASON THESE EVENTS ARE FOR');
    expect(prompt).toContain(`Logline: ${ARC.logline}`);
    expect(prompt).toContain('Current part: Part 2 of 3, "The Climb"');
    expect((await buildEventPrompt(db(null), 'show-1')).prompt).not.toContain('THE SEASON');
  });

  test('a Pulse post: the season as mood, never named; unchanged without', () => {
    const { buildPrompt, buildPostBatchPrompt, seasonMood } = require('../../../src/services/pulseDrafter');
    const args = { character: { display_name: 'Maya' }, profile: { handle: 'maya' }, voice: {}, label: 'now', context: {} };
    const line = seasonLine(fromArc(ARC), { about: false });
    const post = buildPrompt({ ...args, season: line });
    expect(post).toContain('never name a season, a part, an episode or a show');
    expect(post).toContain(`Logline: ${ARC.logline}`);
    expect(buildPrompt(args)).toBe(buildPrompt({ ...args, season: '' }));
    expect(buildPrompt(args)).not.toContain("Lala's story is now");
    const entries = [{ ...args, known: null }];
    expect(buildPostBatchPrompt(entries, { label: 'now', season: line })).toContain(seasonMood(line));
    expect(buildPostBatchPrompt(entries, { label: 'now' })).not.toContain("Lala's story is now");
  });

  test("the feed's venue writer names the season and its current part", async () => {
    jest.resetModules();
    const create = jest.fn(async () => ({ content: [{ text: 'A velvet room.' }] }));
    jest.doMock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create } })));
    jest.doMock('../../../src/services/brainRules', () => ({ loadBrainContext: async () => ({ block: '', ids: [] }), recordRuleUse: async () => {} }));
    jest.doMock('../../../src/models', () => ({ sequelize: { query: async () => [[ARC]] } }));
    const key = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test';
    try {
      const { generateUniqueVenue } = require('../../../src/services/feedEventPipelineService');
      expect(await generateUniqueVenue('Gala', 'social_event', 'Maya', 7, 'show-1')).toBe('A velvet room.');
    } finally {
      if (key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = key;
    }
    const prompt = create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(`Season 2: "Velvet Ladder" — Up is the only way. Logline: ${ARC.logline}`);
    expect(prompt).toContain('Current part: Part 2 of 3, "The Climb"');
    expect(prompt).not.toContain('Season description');
  });

  test("Lala's phone context carries the episode's season line", async () => {
    jest.resetModules();
    const query = jest.fn(async (sql) => {
      if (/season_context/.test(sql)) return [[{ season_context: SNAPSHOT }]];
      return [[]];
    });
    jest.doMock('../../../src/models', () => ({ sequelize: { query } }));
    const { buildPhoneContext } = require('../../../src/services/phoneContextBuilder');
    const ctx = await buildPhoneContext({ showId: 'show-1', episodeId: 'ep-1', assetId: null });
    expect(ctx.season).toContain('Season 2: "Velvet Ladder"');
    expect(ctx.season).toContain("This episode's part: Part 2 of 3");
    expect(ctx.season).not.toContain('Season description');
  });
});
