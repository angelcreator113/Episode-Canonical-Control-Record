/**
 * The Show Bible in every Feed and event generator (Evoni, 2026-10-06: "make
 * sure it's working with the feed and event creation"). Only the episode
 * script writer read the Bible through selectInjectedRules; Feed posts,
 * profiles, comments, redrafts, Feed-to-event venues and concepts, seasonal
 * events read nothing, and the event generator read ten rules cut to 200
 * characters for every show. loadBrainContext gives them one prompt block,
 * recordRuleUse counts the use, and JustAWoman's Feed (Book 1, the real
 * world) gets no LalaVerse rules.
 */
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { loadBrainContext, recordRuleUse, rulesPromptBlock, ruleText, RULE_CHARS, GENERATOR_LIMIT } = require('../../../src/services/brainRules');

const row = (id, severity, extra = {}) => ({ id, title: `Rule ${id}`, content: `Content ${id}`, category: 'franchise_law', severity, scope: 'franchise', show_id: null, ...extra });
const model = (rows) => ({ findAll: jest.fn(async () => rows.map((r) => ({ toJSON: () => r }))) });

describe('loadBrainContext', () => {
  test('the show\'s always-inject rules as one block, critical first, with their ids', async () => {
    const FranchiseKnowledge = model([row(4, 'important'), row(2, 'critical', { title: 'Prime Coins', content: 'Prime Coins are the only currency.' })]);
    const brain = await loadBrainContext({ FranchiseKnowledge }, { showId: 'show-1', label: 'Test' });
    const where = FranchiseKnowledge.findAll.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: 'active', always_inject: true });
    expect(where[Op.or]).toEqual([{ show_id: null }, { show_id: 'show-1' }]);
    expect(brain.ids).toEqual([2, 4]);
    expect(brain.block).toContain('SHOW BIBLE: ALWAYS TRUE');
    expect(brain.block.indexOf('[CRITICAL] Prime Coins: Prime Coins are the only currency.')).toBeLessThan(brain.block.indexOf('[IMPORTANT] Rule 4'));
    expect(brain.record).toMatchObject({ used_count: 2, eligible: 2, limit: GENERATOR_LIMIT });
  });

  test('no rules is no block; no model is no block', async () => {
    expect(await loadBrainContext({ FranchiseKnowledge: model([]) })).toMatchObject({ block: null, ids: [] });
    expect(await loadBrainContext({})).toMatchObject({ block: null, ids: [] });
  });

  test('a Bible that cannot be read is logged and the generation goes on without it', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const brain = await loadBrainContext({ FranchiseKnowledge: { findAll: jest.fn(async () => { throw new Error('boom'); }) } }, { label: 'FeedPosts' });
    expect(brain).toEqual({ block: null, ids: [], record: null });
    expect(spy).toHaveBeenCalledWith('[FeedPosts] could not read the Show Bible; generating without it:', 'boom');
    spy.mockRestore();
  });

  test('a rule\'s text: a JSON entry\'s summary, whitespace folded, cut to RULE_CHARS', () => {
    expect(ruleText({ content: JSON.stringify({ section: 'identity', summary: 'Fashion is strategy.' }) })).toBe('Fashion is strategy.');
    expect(ruleText({ content: 'a\n\n  b' })).toBe('a b');
    expect(ruleText({ content: 'x'.repeat(RULE_CHARS + 50) })).toHaveLength(RULE_CHARS);
    expect(rulesPromptBlock([])).toBeNull();
  });
});

describe('recordRuleUse', () => {
  test('counts one use of each rule, and does nothing with none', async () => {
    const sequelize = { query: jest.fn(async () => [[], 0]) };
    await recordRuleUse(sequelize, [2, 4], 'Test');
    expect(sequelize.query.mock.calls[0][0]).toMatch(/SET injection_count = COALESCE\(injection_count, 0\) \+ 1, last_injected_at = NOW\(\)/);
    expect(sequelize.query.mock.calls[0][1]).toEqual({ replacements: { ids: [2, 4] } });
    await recordRuleUse(sequelize, [], 'Test');
    await recordRuleUse(null, [1], 'Test');
    expect(sequelize.query).toHaveBeenCalledTimes(1);
  });

  test('a failed count is logged, never thrown', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(recordRuleUse({ query: jest.fn(async () => { throw new Error('nope'); }) }, [1], 'FeedComments')).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith('[FeedComments] could not count the Show Bible rules it used:', 'nope');
    spy.mockRestore();
  });
});

describe('the prompts carry the block', () => {
  const BLOCK = '\nSHOW BIBLE: ALWAYS TRUE (canon)\n- [CRITICAL] Prime Coins: the only currency.\n';

  test('comment drafts and redrafts', () => {
    const { buildPrompt: commentPrompt } = require('../../../src/services/feedCommentDrafter');
    const { buildPrompt: redraftPrompt } = require('../../../src/services/feedPostRedrafter');
    const post = { poster_handle: 'sable', content_text: 'New drop tonight.' };
    expect(commentPrompt(post, [{ profile: { handle: 'maya' }, relationship: null }], BLOCK)).toContain('[CRITICAL] Prime Coins');
    expect(commentPrompt(post, [{ profile: { handle: 'maya' }, relationship: null }])).not.toContain('SHOW BIBLE');
    expect(redraftPrompt(post, null, null, BLOCK)).toContain('[CRITICAL] Prime Coins');
  });

  test('an event concept draft', () => {
    const { buildDraftPrompt } = require('../../../src/services/eventConceptDraftService');
    expect(buildDraftPrompt({ display_name: 'Maya' }, { brainBlock: BLOCK })).toContain('[CRITICAL] Prime Coins');
    expect(buildDraftPrompt({ display_name: 'Maya' }, {})).not.toContain('SHOW BIBLE');
  });

  test('the event generator reads the show\'s rules, in full, and returns their ids', async () => {
    const { buildEventPrompt } = require('../../../src/routes/eventGeneratorRoute');
    const long = 'L'.repeat(400);
    const db = { FranchiseKnowledge: model([row(9, 'critical', { content: long })]), sequelize: { query: jest.fn(async () => []) }, WorldLocation: null };
    const { prompt, brainIds } = await buildEventPrompt(db, 'show-1');
    expect(prompt).toContain(`[CRITICAL] Rule 9: ${long}`);
    expect(brainIds).toEqual([9]);
    expect(db.FranchiseKnowledge.findAll.mock.calls[0][0].where[Op.or]).toEqual([{ show_id: null }, { show_id: 'show-1' }]);
  });
});

describe('every Feed and event generator loads and counts the Bible', () => {
  const src = (f) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', f), 'utf8');
  const GENERATORS = [
    ['services/feedPostGeneratorService.js', 'FeedPosts'],
    ['services/feedScheduler.js', 'FeedScheduler'],
    ['routes/socialProfileRoutes.js', 'SocialProfiles'],
    ['services/feedCommentDrafter.js', 'FeedComments'],
    ['services/feedPostRedrafter.js', 'FeedRedraft'],
    ['services/feedEventPipelineService.js', 'FeedEventVenue'],
    ['services/eventConceptDraftService.js', 'eventConceptDraft'],
    ['services/seasonalEventService.js', 'SeasonalEvents'],
    ['routes/eventGeneratorRoute.js', 'EventGenerator'],
  ];
  test.each(GENERATORS)('%s', (file, label) => {
    const code = src(file);
    expect(code).toMatch(new RegExp(`loadBrainContext\\([^)]*label: '${label}'`));
    expect(code).toMatch(new RegExp(`recordRuleUse\\([^)]*'${label}'\\)`));
  });

  test('JustAWoman\'s Feed (the real world) gets no LalaVerse rules', () => {
    const scheduler = src('services/feedScheduler.js');
    expect(scheduler).toMatch(/const brain = layer === 'lalaverse' \? await loadBrainContext\(/);
    expect(scheduler).toMatch(/let brain = NO_BRAIN;\n {2}if \(layer === 'lalaverse'\) \{/);
    const profiles = src('routes/socialProfileRoutes.js');
    expect(profiles.match(/const brain = layer === 'lalaverse'\n\s+\? await loadBrainContext/g)).toHaveLength(2);
  });

  test('the old ten-rule read is gone from the event generator', () => {
    const code = src('routes/eventGeneratorRoute.js');
    expect(code).not.toMatch(/FranchiseKnowledge\.findAll/);
    expect(code).not.toMatch(/franchise_knowledge may not exist/);
  });

  test('every caller of the concept draft passes the models and the show', () => {
    expect(src('services/eventAutomationService.js')).toMatch(/draftEventConcept\(host, \{[^}]*models, showId \}\)/);
    expect(src('services/feedEventPipelineService.js')).toMatch(/draftEventConcept\(creatorProfile, \{[\s\S]{0,200}models,\s*showId,/);
    expect(src('routes/worldEvents.js')).toMatch(/draftEventConcept\(p, \{[^}]*models: req\.app\.locals\.db \|\| require\('\.\.\/models'\), showId: req\.params\.showId \}\)/);
  });
});
