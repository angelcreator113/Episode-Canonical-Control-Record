// ============================================================================
// Character voices that learn (Evoni, 2026-10-25): the pure parts of
// services/characterVoice (who a speaker is, what she changed, a rule's
// check, the writers' block) and the writers' prompts carrying the block.
// No database, no network; the AI is mocked.
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

const cv = () => require('../../../src/services/characterVoice');

/** A fake sequelize that answers by the first pattern its SQL matches. */
const fakeModels = (answers = []) => ({
  sequelize: {
    query: jest.fn(async (sql) => {
      const hit = answers.find(([re]) => re.test(sql));
      return hit ? hit[1] : [];
    }),
  },
});

describe('who a speaker is', () => {
  const registry = [
    { id: 'c1', character_key: 'marcus-reed', display_name: 'Marcus Reed', selected_name: null, handle: 'marcusreed', profile_name: 'Marcus Reed', aliases: ['MJ'], show_id: 's1' },
    { id: 'c2', character_key: 'velour-host', display_name: 'Simone Velour', selected_name: 'Simone', handle: '@simonev', profile_name: null, aliases: null, show_id: null },
    { id: 'c3', character_key: 'mira-a', display_name: 'Mira Ade', handle: null, show_id: 's1' },
    { id: 'c4', character_key: 'mira-b', display_name: 'Mira Bell', handle: null, show_id: 's1' },
  ];
  const models = () => fakeModels([[/FROM registry_characters rc/, registry]]);

  test.each([
    ['Me', 'justawoman'], ['Prime', 'justawoman'], ['JustAWoman', 'justawoman'], ['JAWIHP', 'justawoman'],
    ['Lala', 'lala'], ['LALA (V.O.)', 'lala'],
    ['Marcus Reed', 'marcus-reed'], ['marcus-reed', 'marcus-reed'], ['@marcusreed', 'marcus-reed'], ['MJ', 'marcus-reed'],
    ['Marcus', 'marcus-reed'], ['Simone', 'velour-host'], ['simonev', 'velour-host'],
  ])('%s is %s', async (speaker, key) => {
    expect(await cv().resolveCharacterKey(models(), { speaker, showId: '3f2a9c1e-0000-4000-8000-000000000001' })).toBe(key);
  });

  test('an unknown speaker, a Guest, and a first name two characters share are no one', async () => {
    const r = await cv().makeResolver(models(), { showId: '3f2a9c1e-0000-4000-8000-000000000001' });
    expect(await r.resolve('Guest')).toBeNull();
    expect(await r.resolve('Stranger')).toBeNull();
    expect(await r.resolve('Mira')).toBeNull();
    expect(await r.resolve('Mira Bell')).toEqual({ characterKey: 'mira-b', name: 'Mira Bell' });
  });

  test("her and Lala's keys need no database", async () => {
    const r = await cv().makeResolver({}, {});
    expect(await r.resolve('Me')).toEqual({ characterKey: 'justawoman', name: 'JustAWoman' });
    expect(await r.resolve('Lala')).toEqual({ characterKey: 'lala', name: 'Lala' });
  });
});

describe('the script and what she changed', () => {
  const script = [
    beatHeader(CANONICAL_BEATS[0]),
    'Me: Hi besties, welcome back.',
    '(She waves.)',
    'Lala: "Bestie. Look at this."',
    'Location: the closet',
    beatHeader(CANONICAL_BEATS[11]),
    'Lala: (beat)',
    'Marcus: You came.',
  ].join('\n');

  test('each beat keeps its spoken lines, quotes and stage-only lines dropped', () => {
    const d = cv().scriptDialogue(script);
    expect(d.get(1)).toEqual([
      { speaker: 'Prime', label: 'Me', words: 'Hi besties, welcome back.' },
      { speaker: 'Lala', label: 'Lala', words: 'Bestie. Look at this.' },
    ]);
    expect(d.get(12)).toEqual([{ speaker: 'Marcus', label: 'Marcus', words: 'You came.' }]);
  });

  test('a kept line is no change; an edited one pairs with the most alike', () => {
    const ai = [{ words: 'Hello my lovely besties and welcome back to the show today.' }, { words: 'Let us look at the closet.' }];
    const hers = [{ words: 'Let us look at the closet.' }, { words: 'Hi besties, welcome back.' }];
    expect(cv().alignChanges(ai, hers)).toEqual([{ original: 'Hello my lovely besties and welcome back to the show today.', edited: 'Hi besties, welcome back.' }]);
  });

  test('a new line with nothing like it is no edit', () => {
    expect(cv().alignChanges([{ words: 'One' }, { words: 'Two words here' }], [{ words: 'Completely different sentence entirely' }, { words: 'One' }, { words: 'Two words here' }])).toEqual([]);
  });

  test('beats 11-13 are the cutscene, the rest gameplay; a book line is narration unless the scene says so', () => {
    const { contextForBeat, bookContext } = cv();
    expect([1, 10, 11, 12, 13, 14].map(contextForBeat)).toEqual(['gameplay', 'gameplay', 'cutscene', 'cutscene', 'cutscene', 'gameplay']);
    expect(bookContext({ chapter_type: 'chapter' }, {})).toBe('narration');
    expect(bookContext({ chapter_type: 'cutscene' }, {})).toBe('cutscene');
    expect(bookContext({}, { voice_type: 'gameplay' })).toBe('gameplay');
    expect(bookContext(null, null)).toBe('narration');
  });
});

describe("a rule's check and the AI's reply", () => {
  test('only the known checks, cleaned', () => {
    const { normalizeCheck } = cv();
    expect(normalizeCheck({ type: 'max_sentences', n: '2' })).toEqual({ type: 'max_sentences', n: 2 });
    expect(normalizeCheck({ type: 'banned_word', word: '  literally ' })).toEqual({ type: 'banned_word', word: 'literally' });
    expect(normalizeCheck({ type: 'uses_phrase', phrase: 'bestie', every_n_lines: 6 })).toEqual({ type: 'uses_phrase', phrase: 'bestie', every_n_lines: 6 });
    expect(normalizeCheck({ type: 'max_sentences', n: 0 })).toBeNull();
    expect(normalizeCheck({ type: 'vibes' })).toBeNull();
    expect(normalizeCheck(null)).toBeNull();
  });

  test('the reply is read from fenced or wrapped JSON', () => {
    const { parseReply } = cv();
    expect(parseReply('```json\n{"rules":[]}\n```')).toEqual({ rules: [] });
    expect(parseReply('Here: {"a":1} done')).toEqual({ a: 1 });
    expect(parseReply('nope')).toBeNull();
  });

  test('a missing table or column reads as the migration not having run', () => {
    const { isSchemaMissing } = cv();
    expect(isSchemaMissing({ original: { code: '42P01' } })).toBe(true);
    expect(isSchemaMissing({ parent: { code: '42703' } })).toBe(true);
    expect(isSchemaMissing(new Error('column "check_json" does not exist'))).toBe(true);
    expect(isSchemaMissing(new Error('deadlock'))).toBe(false);
  });
});

describe("the writers' block", () => {
  const voices = [{
    characterKey: 'lala', name: 'Lala',
    profile: [['Speech pattern', 'short, bright']],
    rules: [{ rule_text: 'Never more than two sentences.', context: 'cutscene' }, { rule_text: 'Says "bestie", never "babe".', context: 'all' }],
    lines: ['Bestie. Look.'],
  }];

  test('HOW LALA REALLY SOUNDS, the learned voice winning, cutscene rules labelled in the whole show', () => {
    const t = cv().voicesText(voices, 'show');
    expect(t).toContain('HOW LALA REALLY SOUNDS');
    expect(t).toContain('the learned voice wins');
    expect(t).toContain('Profile: Speech pattern: short, bright');
    expect(t).toContain('- Never more than two sentences. (cutscene, beats 11-13 only)');
    expect(t).toContain('- Says "bestie", never "babe".');
    expect(t).toContain('- "Bestie. Look."');
  });

  test("one beat's block does not label its own context", () => {
    expect(cv().voicesText(voices, 'cutscene')).toContain('- Never more than two sentences.\n');
  });

  test('nothing known is no block', async () => {
    expect(cv().voicesText([], 'show')).toBe('');
    expect(await cv().voicePromptBlock({}, { characterKeys: ['lala'] })).toBe('');
  });

  test('voicePromptBlock reads profile, rules of the context or all, and lines, null-safe without the migration', async () => {
    const models = fakeModels([
      [/to_regclass\('public.character_voice_lines'\)/, [{ lines: true, rules: true, signals: true }]],
      [/FROM registry_characters rc/, [{ character_key: 'lala', display_name: 'Lala', voice_signature: { speech_pattern: 'short', tell: '', catchphrases: ['bestie', 'obsessed'] } }]],
      [/FROM voice_rules/, [{ id: 1, rule_text: 'Two sentences at most.', context: 'gameplay' }]],
      [/context IN \(:reads\)/, [{ text: 'Bestie, the closet.' }]],
      [/context NOT IN/, [{ text: 'An older one.' }]],
    ]);
    const block = await cv().voicePromptBlock(models, { characterKeys: ['lala'], context: 'gameplay', limitLines: 2 });
    expect(block).toContain('Profile: Speech pattern: short | Catchphrases: bestie; obsessed');
    expect(block).not.toContain('Tell:');
    expect(block).toContain('- Two sentences at most.');
    expect(block).toContain('- "Bestie, the closet."');
    expect(block).toContain('- "An older one."');
    const rulesSql = models.sequelize.query.mock.calls.find(([s]) => /FROM voice_rules/.test(s));
    expect(rulesSql[1].replacements.reads).toEqual(['gameplay']);

    const before = fakeModels([
      [/to_regclass/, [{ lines: false, rules: false, signals: false }]],
      [/FROM registry_characters rc/, [{ character_key: 'lala', display_name: 'Lala', voice_signature: { speech_pattern: 'short' } }]],
    ]);
    const only = await cv().voicePromptBlock(before, { characterKeys: ['lala'], context: 'gameplay' });
    expect(only).toContain('Profile: Speech pattern: short');
    expect(only).not.toContain('Learned rules');
    expect(before.sequelize.query.mock.calls.some(([s]) => /FROM voice_rules|character_voice_lines WHERE/.test(s))).toBe(false);
  });
});

describe("the writers' prompts carry the learned voices", () => {
  const FULL = CANONICAL_BEATS.map((b) => `${beatHeader(b)}\nMe: hi`).join('\n\n');
  const BLOCK = '═══ LEARNED VOICES (test) ═══\nHOW LALA REALLY SOUNDS\n- Two sentences at most.';
  const story = { voices: BLOCK, voiceKeys: ['justawoman', 'lala', 'marcus-reed'], socialProfiles: [], franchiseLaws: [], wardrobe: [], event: null };
  const models = {
    EpisodeBrief: { findOne: async () => ({ forward_hook: 'and then' }) },
    ScenePlan: { findAll: async () => [] }, SceneSet: {},
    sequelize: { query: async () => [[]] },
  };
  const mockAi = () => {
    const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
    const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
    Anthropic.default = Anthropic;
    jest.doMock('@anthropic-ai/sdk', () => Anthropic);
    jest.doMock('../../../src/services/episodeScriptWriterService', () => ({
      ...jest.requireActual('../../../src/services/episodeScriptWriterService'),
      loadScriptContext: jest.fn(async () => story),
    }));
    return create;
  };

  test('the whole script: after the JAWIHP voice DNA', async () => {
    const create = mockAi();
    await require('../../../src/services/groundedScriptGeneratorService').generateGroundedScript('ep1', 'show-1', models);
    const prompt = create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(BLOCK);
    expect(prompt.indexOf(BLOCK)).toBeGreaterThan(prompt.indexOf('JAWIHP'));
  });

  test("one beat: the beat's own context, for the episode's characters", async () => {
    const create = mockAi();
    const block = jest.fn(async ({ context }) => `═══ LEARNED VOICES ═══\nfor ${context}`);
    jest.doMock('../../../src/services/characterVoice', () => ({ ...jest.requireActual('../../../src/services/characterVoice'), voicePromptBlock: (_m, o) => block(o) }));
    await require('../../../src/services/groundedScriptGeneratorService').generateGroundedBeat('ep1', 'show-1', models, { beatNumber: 12, currentScript: FULL });
    expect(block).toHaveBeenCalledWith(expect.objectContaining({ context: 'cutscene', characterKeys: ['justawoman', 'lala', 'marcus-reed'] }));
    expect(create.mock.calls[0][0].messages[0].content).toContain('for cutscene');
  });

  test('the old Script Writer: its prompt has the block', () => {
    const { buildFullPrompt } = jest.requireActual('../../../src/services/episodeScriptWriterService');
    const p = buildFullPrompt({
      brief: {}, scenePlan: [], event: null, financial: null, wardrobe: [], franchiseLaws: [], worldState: null, worldNow: '',
      career: null, beat14: null, onScreen: [], phone: null, money: null, voices: BLOCK,
    });
    expect(p).toContain(BLOCK);
  });
});
