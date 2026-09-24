// ============================================================================
// Task #1790 — starting an event from a Feed creator does not make them the
// organizer. Mocked models, no database.
// ============================================================================
// POST /world/:showId/events/from-profile used to write the creator as the
// organizer in every home it has: `host`, source_profile_id (§8(p) ruling 6's
// interim creator-organizer home) and the automation.host_* copy. Now it
// writes none of them and records the creator only as
// canon_consequences.automation.started_from_profile_id. What it derives from
// the creator is kept as context (guest list, venue, invitation style,
// brand_partnerships). The name and description no longer say the creator
// hosts the event. GET /world/:showId/events/:eventId returns the creator as
// `startedFromProfile` so the Event Package can suggest them.

const express = require('express');
const request = require('supertest');

const mockCreate = jest.fn();
const mockQuery = jest.fn();
const mockFindProfile = jest.fn();
let mockProfile;
const baseProfile = () => ({
  id: 42, handle: 'hosty', display_name: 'Hosty', content_category: 'fashion',
  archetype: 'soft_life', follower_tier: 'macro', brand_partnerships: [{ brand: 'Velour' }],
  registry_character_id: 'rc-7', lala_relevance_score: 5, aesthetic_dna: {}, city: null, frequent_venues: [],
});

jest.mock('../../../src/models', () => ({
  sequelize: { query: (...a) => mockQuery(...a) },
  SocialProfile: {
    findByPk: (...a) => mockFindProfile(...a),
    findAll: jest.fn(async () => []),
  },
  WorldEvent: { create: (...a) => mockCreate(...a) },
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

const ORGANIZER_AUTO_KEYS = ['host_profile_id', 'host_handle', 'host_display_name', 'host_registry_character_id'];
const HOST_WORDS = /\bhost(s|ed|ing)?\b|\borganiz/i;

beforeEach(() => {
  mockProfile = baseProfile();
  mockFindProfile.mockReset();
  mockFindProfile.mockImplementation(async () => ({ toJSON: () => mockProfile }));
  mockCreate.mockReset();
  mockCreate.mockImplementation(async (data) => ({ id: 'ev-new', ...data, toJSON: () => ({ id: 'ev-new', ...data }) }));
  mockQuery.mockReset();
  mockQuery.mockResolvedValue([[]]);
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function createFromProfile(body = { profile_id: 42, event_template: 'Event' }) {
  const res = await request(app).post('/api/v1/world/show-1/events/from-profile').send(body);
  expect(res.status).toBe(201);
  return mockCreate.mock.calls[0][0];
}

describe('POST /world/:showId/events/from-profile — no organizer', () => {
  test('writes no organizer field in any home', async () => {
    const data = await createFromProfile();
    const auto = data.canon_consequences.automation;
    expect(data.host).toBeNull();
    expect(data.source_profile_id).toBeNull();
    expect(data.host_brand).toBeNull();
    expect(auto.host_brand).toBeNull();
    for (const key of ORGANIZER_AUTO_KEYS) expect(auto).not.toHaveProperty(key);
  });

  test('records the starting creator as automation.started_from_profile_id', async () => {
    const data = await createFromProfile();
    expect(data.canon_consequences.automation.started_from_profile_id).toBe(42);
  });

  test('keeps what it derives from the creator as context', async () => {
    const data = await createFromProfile();
    const auto = data.canon_consequences.automation;
    expect(auto).toHaveProperty('guest_profiles');
    expect(auto.brand_partnerships).toEqual([{ brand: 'Velour' }]);
    expect(auto).toMatchObject({ theme: 'dreamy luxury', border_style: 'watercolor wash', content_category: 'fashion' });
    expect(data).toMatchObject({ theme: 'dreamy luxury', prestige: 6 });
  });

  test('the name and description do not say the creator hosts or organizes it', async () => {
    const data = await createFromProfile();
    expect(data.name).toBe('Event with Hosty');
    expect(data.name).not.toMatch(HOST_WORDS);
    expect(data.description).toMatch(/^An exclusive fashion event with Hosty/);
    expect(data.description).not.toMatch(HOST_WORDS);
    expect(data.canon_consequences.automation.description).toBe(data.description);
  });

  test('without an event_template the name still does not say "Hosts"', async () => {
    const data = await createFromProfile({ profile_id: 42 });
    expect(data.name).toBe('Event with Hosty');
  });

  test('both raw SQL fallbacks bind no host', async () => {
    mockCreate.mockRejectedValueOnce(new Error('create failed'));
    mockQuery.mockImplementation(async (sql) => {
      if (/INSERT INTO world_events \(id, show_id, name, event_type, host, host_brand/.test(sql)) throw new Error('full insert failed');
      return [[]];
    });
    const res = await request(app).post('/api/v1/world/show-1/events/from-profile').send({ profile_id: 42, event_template: 'Event' });
    expect(res.status).toBe(201);
    const inserts = mockQuery.mock.calls.filter(([sql]) => /INSERT INTO world_events/.test(sql));
    expect(inserts).toHaveLength(2);
    for (const [, opts] of inserts) {
      expect(opts.replacements.host).toBeNull();
      const auto = JSON.parse(opts.replacements.canon_consequences).automation;
      expect(auto.started_from_profile_id).toBe(42);
      for (const key of ORGANIZER_AUTO_KEYS) expect(auto).not.toHaveProperty(key);
    }
  });
});

describe('GET /world/:showId/events/:eventId — startedFromProfile', () => {
  const row = (automation) => ({ id: 'ev-1', show_id: 'show-1', name: 'Event with Hosty', source_profile_id: null, canon_consequences: { automation } });

  test('returns the starting creator for an event started from the Feed', async () => {
    mockQuery.mockResolvedValueOnce([[row({ started_from_profile_id: 42 })]]);
    mockFindProfile.mockImplementation(async (id, opts) => ({ toJSON: () => ({ id, handle: 'hosty', display_name: 'Hosty', attrs: opts.attributes }) }));
    const res = await request(app).get('/api/v1/world/show-1/events/ev-1');
    expect(res.status).toBe(200);
    expect(res.body.startedFromProfile).toMatchObject({ id: 42, handle: 'hosty', display_name: 'Hosty' });
    expect(res.body.startedFromProfile.attrs).toEqual(expect.arrayContaining(['id', 'handle', 'display_name', 'registry_character_id']));
    expect(res.body.sourceProfile).toBeNull();
  });

  test('is null for an event not started from the Feed', async () => {
    mockQuery.mockResolvedValueOnce([[row({})]]);
    const res = await request(app).get('/api/v1/world/show-1/events/ev-1');
    expect(res.status).toBe(200);
    expect(res.body.startedFromProfile).toBeNull();
    expect(mockFindProfile).not.toHaveBeenCalled();
  });

  test('a failed lookup is logged and returns null, not an error', async () => {
    mockQuery.mockResolvedValueOnce([[row({ started_from_profile_id: 42 })]]);
    mockFindProfile.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/api/v1/world/show-1/events/ev-1');
    expect(res.status).toBe(200);
    expect(res.body.startedFromProfile).toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/started-from profile lookup failed/), 'db down');
  });
});
