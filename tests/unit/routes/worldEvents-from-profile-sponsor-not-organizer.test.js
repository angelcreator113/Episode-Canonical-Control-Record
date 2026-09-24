// ============================================================================
// Task #1765 — a sponsor is not an organizer. Mocked models, no database.
// ============================================================================
// POST /world/:showId/events/from-profile used to write the creator's first
// brand partnership to host_brand AND canon_consequences.automation.host_brand.
// resolveEventOrganizer (frontend/src/utils/eventReadiness.js) reads
// host_brand || automation.host_brand and lets a brand win over a creator, so
// every event made from a profile with a partnership read "Organized by
// <sponsor>". Now the creator is the organizer (source_profile_id + the
// automation.host_* copy), host_brand is null, automation.host_brand is
// null, and the partnerships are kept as automation.brand_partnerships
// (read by characterSyncService.generatePostEventOpportunities) and in the
// narrative sentence. A profile with no partnerships creates the same event
// as before. The manual create route still honours a supplied host_brand.

const express = require('express');
const request = require('supertest');

const mockCreate = jest.fn();
const mockQuery = jest.fn();
let mockProfile;
const baseProfile = () => ({
  id: 42, handle: 'hosty', display_name: 'Hosty', content_category: 'fashion',
  archetype: 'soft_life', follower_tier: 'macro', brand_partnerships: [],
  registry_character_id: 'rc-7', lala_relevance_score: 5, aesthetic_dna: {}, city: null, frequent_venues: [],
});

jest.mock('../../../src/models', () => ({
  sequelize: { query: (...a) => mockQuery(...a) },
  SocialProfile: {
    findByPk: jest.fn(async () => ({ toJSON: () => mockProfile })),
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

const originalApiKey = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  mockProfile = baseProfile();
  mockCreate.mockReset();
  mockCreate.mockImplementation(async (data) => ({ id: 'ev-new', ...data, toJSON: () => ({ id: 'ev-new', ...data }) }));
  mockQuery.mockReset();
  mockQuery.mockResolvedValue([[]]);
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalApiKey !== undefined) process.env.ANTHROPIC_API_KEY = originalApiKey;
});

// The organizer rule, verbatim from resolveEventOrganizer (eventReadiness.js is
// an ES module the backend jest config does not transform, so it is mirrored
// here; the rule is: brand in either home wins, else the creator).
function organizerOf(ev) {
  const auto = ev.canon_consequences?.automation || {};
  const hasCreator = !!(ev.source_profile_id || auto.host_profile_id);
  const brandName = ev.host_brand || auto.host_brand || null;
  return brandName ? { kind: 'brand', name: brandName } : (hasCreator ? { kind: 'creator', name: auto.host_display_name || ev.host } : null);
}

const EVENT_KEYS = [
  'border_style', 'canon_consequences', 'color_palette', 'cost_coins', 'deadline_type', 'description',
  'dress_code', 'event_date', 'event_time', 'event_type', 'floral_style', 'host', 'host_brand',
  'location_hint', 'mood', 'name', 'narrative_stakes', 'prestige', 'show_id', 'source_profile_id',
  'status', 'strictness', 'theme', 'venue_address', 'venue_location_id', 'venue_name',
];
// Automation keys for a profile with no partnerships (identical to basis 8f1e7831).
const AUTO_KEYS = [
  'aesthetic_power', 'beauty_description', 'beauty_factor', 'border_style', 'color_palette',
  'content_category', 'cost_coins', 'deadline_type', 'description', 'event_date', 'event_date_auto',
  'event_excitement', 'floral_style', 'follow_emotion', 'follow_motivation', 'follow_trigger',
  'guest_profiles', 'host_brand', 'host_display_name', 'host_handle', 'host_profile_id', 'host_registry_character_id',
  'lifestyle_claim', 'lifestyle_gap', 'lifestyle_reality', 'mood', 'narrative_stakes', 'social_tasks',
  'strictness', 'theme', 'venue_address', 'venue_location_id', 'venue_name',
];

async function createFromProfile() {
  const res = await request(app).post('/api/v1/world/show-1/events/from-profile').send({ profile_id: 42, event_template: 'Event' });
  expect(res.status).toBe(201);
  return mockCreate.mock.calls[0][0];
}

describe('POST /world/:showId/events/from-profile — sponsor is not the organizer', () => {
  test('a profile with brand partnerships: creator is the organizer, no host_brand in either home', async () => {
    mockProfile.brand_partnerships = [{ brand: 'Velour', type: 'ambassador', visible: true }, { brand: 'Ori Beauty', type: 'gifted', visible: false }];
    const data = await createFromProfile();
    const auto = data.canon_consequences.automation;

    expect(data.host_brand).toBeNull();
    expect(auto.host_brand).toBeNull();
    expect(data.source_profile_id).toBe(42);
    expect(data.host).toBe('Hosty');
    expect(auto).toMatchObject({ host_profile_id: 42, host_handle: 'hosty', host_display_name: 'Hosty', host_registry_character_id: 'rc-7' });
    expect(organizerOf(data)).toEqual({ kind: 'creator', name: 'Hosty' });

    // The sponsor is kept, outside the organizer fields.
    expect(auto.brand_partnerships).toEqual(mockProfile.brand_partnerships);
    expect(data.narrative_stakes).toMatch(/Brand opportunity with Velour\.$/);

    expect(Object.keys(data).sort()).toEqual(EVENT_KEYS);
    expect(Object.keys(auto).sort()).toEqual([...AUTO_KEYS, 'brand_partnerships'].sort());
  });

  test('raw SQL fallback binds host_brand null in both homes', async () => {
    mockProfile.brand_partnerships = [{ brand: 'Velour' }];
    mockCreate.mockRejectedValueOnce(new Error('create failed'));
    const res = await request(app).post('/api/v1/world/show-1/events/from-profile').send({ profile_id: 42 });
    expect(res.status).toBe(201);
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO world_events/.test(sql));
    const r = insert[1].replacements;
    expect(r.host_brand).toBeNull();
    const auto = JSON.parse(r.canon_consequences).automation;
    expect(auto.host_brand).toBeNull();
    expect(auto.brand_partnerships).toEqual([{ brand: 'Velour' }]);
  });

  test('malformed partnership entries are not copied into automation.brand_partnerships', async () => {
    mockProfile.brand_partnerships = [null, 'Velour', { type: 'gifted' }, { brand: 'Ori Beauty' }];
    const data = await createFromProfile();
    expect(data.canon_consequences.automation.brand_partnerships).toEqual([{ brand: 'Ori Beauty' }]);
    expect(data.host_brand).toBeNull();
  });

  test('a profile without partnerships is unchanged: same keys, host_brand null, no sponsor sentence', async () => {
    const data = await createFromProfile();
    const auto = data.canon_consequences.automation;
    expect(Object.keys(data).sort()).toEqual(EVENT_KEYS);
    expect(Object.keys(auto).sort()).toEqual(AUTO_KEYS);
    expect(data).toMatchObject({
      show_id: 'show-1', name: "Hosty's Event", event_type: 'invite', host: 'Hosty', host_brand: null,
      source_profile_id: 42, prestige: 6, cost_coins: 300, strictness: 6, deadline_type: 'medium',
      dress_code: null, event_time: null, status: 'draft',
    });
    expect(data.narrative_stakes).not.toMatch(/Brand opportunity/);
    expect(organizerOf(data)).toEqual({ kind: 'creator', name: 'Hosty' });
  });
});

describe('POST /world/:showId/events — a caller-supplied host_brand is still honoured', () => {
  test('host_brand from the request body is written to the column', async () => {
    const res = await request(app).post('/api/v1/world/show-1/events').send({ name: 'Velour Gala', host_brand: 'Velour' });
    expect(res.status).toBe(201);
    const data = mockCreate.mock.calls[0][0];
    expect(data.host_brand).toBe('Velour');
    expect(organizerOf(data)).toEqual({ kind: 'brand', name: 'Velour' });
  });

  test('from-profile ignores a host_brand in the body (it never accepted one)', async () => {
    mockProfile.brand_partnerships = [{ brand: 'Velour' }];
    await request(app).post('/api/v1/world/show-1/events/from-profile').send({ profile_id: 42, host_brand: 'Maison Belle' });
    expect(mockCreate.mock.calls[0][0].host_brand).toBeNull();
  });
});
