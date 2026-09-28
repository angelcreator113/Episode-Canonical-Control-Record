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
const DRAFT_KEYS = ['concept', 'activity', 'auto_drafted'];

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
  });

  test('changes nothing else the route saves', async () => {
    mockDraft.mockResolvedValue(null);
    await post();
    const withoutDraft = mockCreate.mock.calls[0][0];

    mockCreate.mockClear();
    mockDraft.mockResolvedValue(DRAFT);
    await post();
    const withDraft = mockCreate.mock.calls[0][0];

    const strip = (d) => {
      const { description: _d, canon_consequences: cc, ...rest } = d;
      const { description: _ad, concept: _c, activity: _a, auto_drafted: _ab, ...auto } = cc.automation;
      return { ...rest, automation: auto };
    };
    expect(strip(withDraft)).toEqual(strip(withoutDraft));
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
