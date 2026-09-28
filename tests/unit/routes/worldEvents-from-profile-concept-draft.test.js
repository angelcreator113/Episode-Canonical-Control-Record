// ============================================================================
// Task #2122 — POST /world/:showId/events/from-profile saves the creation
// draft (§8(u) R1, R8; §8(v)). Mocked models and draft service; no database,
// no network.
// ============================================================================
// With a draft: the drafted description replaces the template in both homes,
// and canon_consequences.automation carries concept, activity and
// auto_drafted. With no draft (null): the template description and no draft
// keys, exactly as before. The raw-SQL fallbacks bind the same values.

const express = require('express');
const request = require('supertest');

const mockCreate = jest.fn();
const mockQuery = jest.fn();
const mockDraft = jest.fn();
const mockProfile = {
  id: 42, handle: 'mayamoves', display_name: 'Maya Moves', content_category: 'fitness',
  archetype: 'soft_life', follower_tier: 'macro', brand_partnerships: [],
  registry_character_id: null, lala_relevance_score: 5, aesthetic_dna: {}, city: null, frequent_venues: [],
};

jest.mock('../../../src/models', () => ({
  sequelize: { query: (...a) => mockQuery(...a) },
  SocialProfile: {
    findByPk: jest.fn(async () => ({ toJSON: () => mockProfile })),
    findAll: jest.fn(async () => []),
  },
  WorldEvent: { create: (...a) => mockCreate(...a) },
}));
jest.mock('../../../src/services/eventConceptDraftService', () => ({
  draftEventConcept: (...a) => mockDraft(...a),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/services/episodeGeneratorService', () => ({ buildSocialTasks: () => [] }));

const router = require('../../../src/routes/worldEvents');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

const DRAFT = {
  concept: 'A sunset sculpt workout that ends in a recovery social.',
  activity: 'Guests take a guided rooftop sculpt class, then stretch and share mocktails.',
  description: 'A golden-hour sculpt session to close out summer. Expect a guided class, a slow stretch and a relaxed social afterwards.',
};
const DRAFT_KEYS = ['concept', 'activity', 'auto_drafted', 'styling_brief'];
// Task #2124: the same draft with styling.
const STYLING = {
  dress_code: 'Sleek performance activewear with a light layer for the social',
  dress_code_keywords: ['practical', 'modern', 'comfortable'],
  styling_brief: {
    activity: 'A sculpt class on mats, then mingling',
    formality: 'casual',
    function_requirements: ['full range of movement'],
    avoid: ['heels'],
    style_direction: 'Polished athleisure.',
  },
};
const STYLED = { ...DRAFT, styling: STYLING };
const ALL_DRAFTED = {
  description: 'ai_draft', concept: 'ai_draft', activity: 'ai_draft',
  dress_code: 'ai_draft', dress_code_keywords: 'ai_draft', styling_brief: 'ai_draft',
};
const failBothToMinimal = () => {
  mockCreate.mockRejectedValueOnce(new Error('create failed'));
  mockQuery.mockImplementation(async (sql) => {
    if (/INSERT INTO world_events \(id, show_id, name, event_type, host, host_brand/.test(sql)) throw new Error('full insert failed');
    return [[]];
  });
};
const failToFull = () => {
  mockCreate.mockRejectedValueOnce(new Error('create failed'));
};
const insertsOf = () => mockQuery.mock.calls.filter(([sql]) => /INSERT INTO world_events/.test(sql));
const isFull = (sql) => /host_brand/.test(sql);

const originalApiKey = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  mockDraft.mockReset();
  mockCreate.mockReset();
  mockCreate.mockImplementation(async (data) => ({ id: 'ev-new', ...data, toJSON: () => ({ id: 'ev-new', ...data }) }));
  mockQuery.mockReset();
  mockQuery.mockResolvedValue([[]]);
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  // generateUniqueVenue calls the Anthropic API only when this is set.
  delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalApiKey !== undefined) process.env.ANTHROPIC_API_KEY = originalApiKey;
});

const post = () => request(app).post('/api/v1/world/show-1/events/from-profile').send({ profile_id: 42 });

describe('from-profile with a draft', () => {
  test('saves the drafted description in both homes, and concept, activity and auto_drafted', async () => {
    mockDraft.mockResolvedValue(DRAFT);
    const res = await post();
    expect(res.status).toBe(201);

    expect(mockDraft).toHaveBeenCalledTimes(1);
    const [profileArg, contextArg] = mockDraft.mock.calls[0];
    expect(profileArg.id).toBe(42);
    expect(contextArg.userId).toBe('u1');

    const data = mockCreate.mock.calls[0][0];
    const auto = data.canon_consequences.automation;
    expect(data.description).toBe(DRAFT.description);
    expect(auto.description).toBe(DRAFT.description);
    expect(auto.concept).toBe(DRAFT.concept);
    expect(auto.activity).toBe(DRAFT.activity);
    expect(auto.auto_drafted).toEqual({ description: 'ai_draft', concept: 'ai_draft', activity: 'ai_draft' });
    // No styling in this draft: dress code and keywords as before.
    expect(data.dress_code).toBeNull();
    expect(data).not.toHaveProperty('dress_code_keywords');
    expect(auto).not.toHaveProperty('styling_brief');
  });

  test('Task #2124: a draft with styling saves dress_code, dress_code_keywords and automation.styling_brief, all marked', async () => {
    mockDraft.mockResolvedValue(STYLED);
    const res = await post();
    expect(res.status).toBe(201);
    const data = mockCreate.mock.calls[0][0];
    const auto = data.canon_consequences.automation;
    expect(data.dress_code).toBe(STYLING.dress_code);
    expect(data.dress_code_keywords).toEqual(STYLING.dress_code_keywords);
    expect(auto.styling_brief).toEqual(STYLING.styling_brief);
    expect(auto).not.toHaveProperty('dress_code');
    expect(auto).not.toHaveProperty('dress_code_keywords');
    expect(auto.auto_drafted).toEqual(ALL_DRAFTED);
    expect(data.description).toBe(DRAFT.description);
  });

  test('changes nothing else the route saves', async () => {
    mockDraft.mockResolvedValue(null);
    await post();
    const withoutDraft = mockCreate.mock.calls[0][0];

    mockCreate.mockClear();
    mockDraft.mockResolvedValue(DRAFT);
    await post();
    const withDraft = mockCreate.mock.calls[0][0];

    mockCreate.mockClear();
    mockDraft.mockResolvedValue(STYLED);
    await post();
    const withStyled = mockCreate.mock.calls[0][0];

    // Task #2124: dress_code and dress_code_keywords also differ with styling.
    const strip = (d) => {
      const { description: _d, dress_code: _dc, dress_code_keywords: _dk, canon_consequences: cc, ...rest } = d;
      const { description: _ad, concept: _c, activity: _a, auto_drafted: _ab, styling_brief: _sb, ...auto } = cc.automation;
      return { ...rest, automation: auto };
    };
    expect(strip(withDraft)).toEqual(strip(withoutDraft));
    expect(strip(withStyled)).toEqual(strip(withoutDraft));
    expect(withDraft.name).toBe('Event with Maya Moves');
  });

  test('the raw-SQL fallbacks bind the drafted description and draft keys', async () => {
    mockDraft.mockResolvedValue(DRAFT);
    mockCreate.mockRejectedValueOnce(new Error('create failed'));
    mockQuery.mockImplementation(async (sql) => {
      if (/INSERT INTO world_events \(id, show_id, name, event_type, host, host_brand/.test(sql)) throw new Error('full insert failed');
      return [[]];
    });
    const res = await post();
    expect(res.status).toBe(201);

    const inserts = mockQuery.mock.calls.filter(([sql]) => /INSERT INTO world_events/.test(sql));
    expect(inserts).toHaveLength(2);
    for (const [, { replacements }] of inserts) {
      expect(replacements.description).toBe(DRAFT.description);
      const auto = JSON.parse(replacements.canon_consequences).automation;
      expect(auto.concept).toBe(DRAFT.concept);
      expect(auto.activity).toBe(DRAFT.activity);
      expect(auto.auto_drafted).toEqual({ description: 'ai_draft', concept: 'ai_draft', activity: 'ai_draft' });
    }
  });
});

describe('from-profile with no draft (null)', () => {
  test('saves the template description and no draft keys', async () => {
    mockDraft.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(201);

    const data = mockCreate.mock.calls[0][0];
    const auto = data.canon_consequences.automation;
    expect(data.description).toMatch(/^An exclusive fitness event with Maya Moves/);
    expect(auto.description).toBe(data.description);
    for (const key of DRAFT_KEYS) expect(auto).not.toHaveProperty(key);
  });

  test('the raw-SQL fallbacks bind the template description and no draft keys', async () => {
    mockDraft.mockResolvedValue(null);
    mockCreate.mockRejectedValueOnce(new Error('create failed'));
    mockQuery.mockImplementation(async (sql) => {
      if (/INSERT INTO world_events \(id, show_id, name, event_type, host, host_brand/.test(sql)) throw new Error('full insert failed');
      return [[]];
    });
    const res = await post();
    expect(res.status).toBe(201);

    const inserts = mockQuery.mock.calls.filter(([sql]) => /INSERT INTO world_events/.test(sql));
    expect(inserts).toHaveLength(2);
    for (const [, { replacements }] of inserts) {
      expect(replacements.description).toMatch(/^An exclusive fitness event with Maya Moves/);
      const auto = JSON.parse(replacements.canon_consequences).automation;
      for (const key of DRAFT_KEYS) expect(auto).not.toHaveProperty(key);
    }
  });
});

describe('Task #2124: raw-SQL fallbacks and styling', () => {
  test('the full insert binds the drafted dress code and keywords (jsonb)', async () => {
    mockDraft.mockResolvedValue(STYLED);
    failToFull();
    expect((await post()).status).toBe(201);
    const inserts = insertsOf();
    expect(inserts).toHaveLength(1);
    const [sql, { replacements }] = inserts[0];
    expect(isFull(sql)).toBe(true);
    expect(sql).toMatch(/:dress_code_keywords::jsonb/);
    expect(replacements.dress_code).toBe(STYLING.dress_code);
    expect(JSON.parse(replacements.dress_code_keywords)).toEqual(STYLING.dress_code_keywords);
    const auto = JSON.parse(replacements.canon_consequences).automation;
    expect(auto.styling_brief).toEqual(STYLING.styling_brief);
    expect(auto.auto_drafted).toEqual(ALL_DRAFTED);
  });

  test('the full insert with no styling binds no dress code and the column default []', async () => {
    mockDraft.mockResolvedValue(null);
    failToFull();
    await post();
    const [, { replacements }] = insertsOf()[0];
    expect(replacements.dress_code).toBeNull();
    expect(JSON.parse(replacements.dress_code_keywords)).toEqual([]);
  });

  test('the minimal insert is unchanged: no dress code or keywords, but canon_consequences carries styling_brief', async () => {
    mockDraft.mockResolvedValue(STYLED);
    failBothToMinimal();
    expect((await post()).status).toBe(201);
    const minimal = insertsOf().find(([sql]) => !isFull(sql));
    const [sql, { replacements }] = minimal;
    expect(sql).not.toMatch(/dress_code/);
    expect(replacements).not.toHaveProperty('dress_code');
    expect(replacements).not.toHaveProperty('dress_code_keywords');
    expect(JSON.parse(replacements.canon_consequences).automation.styling_brief).toEqual(STYLING.styling_brief);
  });
});
