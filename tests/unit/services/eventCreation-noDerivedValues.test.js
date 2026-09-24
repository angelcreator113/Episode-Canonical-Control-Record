// ============================================================================
// Task #1757 — creation paths stop saving a derived time or dress code.
// Mocked models, no database.
// ============================================================================
// Before this task these paths derived an event time from prestige and/or a
// dress code from category or opportunity type, and saved them (to the
// column, the canon_consequences.automation copy, or both), so the Event
// Package showed "Set" for values nobody chose:
//   - POST /world/:showId/events/from-profile  (worldEvents.js)
//   - spawnEventsFromCalendar                   (eventAutomationService.js)
//   - scheduleOpportunityAsEvent                (feedEventPipelineService.js)
//   - chainEventFromMomentum                    (feedEventPipelineService.js)
// A value the source supplied is still saved (the calendar event's
// activities.dress_code, the opportunity's wardrobe_brief.dress_code).
// Everything else on the created event — prestige, cost_coins, strictness,
// deadline_type, date, venue, style — is asserted unchanged. Cost is still
// derived (cost_coins is NOT NULL DEFAULT 100; see the PR for #1757).

const express = require('express');
const request = require('supertest');

const mockCreate = jest.fn();
const mockQuery = jest.fn();
const mockProfile = {
  id: 42, handle: 'hosty', display_name: 'Hosty', content_category: 'fashion',
  archetype: 'soft_life', follower_tier: 'macro', brand_partnerships: [{ brand: 'Velour' }],
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
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/services/episodeGeneratorService', () => ({ buildSocialTasks: () => [] }));

const router = require('../../../src/routes/worldEvents');
const { spawnEventsFromCalendar } = require('../../../src/services/eventAutomationService');
const { scheduleOpportunityAsEvent, chainEventFromMomentum } = require('../../../src/services/feedEventPipelineService');
const { autoScheduledEventDate } = require('../../../src/utils/eventDateDefault');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

const originalApiKey = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
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

const DATE = () => autoScheduledEventDate();

describe('POST /world/:showId/events/from-profile', () => {
  test('no event time, no dress code, no dress-code keywords — column or automation copy', async () => {
    const res = await request(app).post('/api/v1/world/show-1/events/from-profile').send({ profile_id: 42 });
    expect(res.status).toBe(201);
    const data = mockCreate.mock.calls[0][0];

    expect(data.event_time).toBeNull();
    expect(data.dress_code).toBeNull();
    expect(data).not.toHaveProperty('dress_code_keywords');
    const auto = data.canon_consequences.automation;
    for (const k of ['event_time', 'dress_code', 'dress_code_keywords']) {
      expect(auto).not.toHaveProperty(k);
    }
  });

  test('everything else is unchanged (macro tier → prestige 6)', async () => {
    await request(app).post('/api/v1/world/show-1/events/from-profile').send({ profile_id: 42 });
    const data = mockCreate.mock.calls[0][0];
    expect(data).toMatchObject({
      // Task #1765: a sponsor is not an organizer. Task #1790: nor is the
      // creator — no host, no source_profile_id, and a name that does not
      // say they host it (no event_template sent, so the default 'Event').
      show_id: 'show-1', name: 'Event with Hosty', event_type: 'invite', host: null, host_brand: null,
      source_profile_id: null, prestige: 6, cost_coins: 300, strictness: 6, deadline_type: 'medium',
      event_date: DATE(), theme: 'dreamy luxury', mood: 'serene, aspirational, soft, fashion-forward',
      floral_style: 'fashion show florals', border_style: 'watercolor wash', status: 'draft',
    });
    expect(Object.keys(data).sort()).toEqual([
      'border_style', 'canon_consequences', 'color_palette', 'cost_coins', 'deadline_type', 'description',
      'dress_code', 'event_date', 'event_time', 'event_type', 'floral_style', 'host', 'host_brand',
      'location_hint', 'mood', 'name', 'narrative_stakes', 'prestige', 'show_id', 'source_profile_id',
      'status', 'strictness', 'theme', 'venue_address', 'venue_location_id', 'venue_name',
    ]);
    expect(data.canon_consequences.automation).toMatchObject({
      event_date: DATE(), event_date_auto: DATE(), cost_coins: 300, strictness: 6, deadline_type: 'medium',
      theme: 'dreamy luxury', content_category: 'fashion',
    });
  });

  test('raw SQL fallback binds null time and dress code', async () => {
    mockCreate.mockRejectedValueOnce(new Error('create failed'));
    const res = await request(app).post('/api/v1/world/show-1/events/from-profile').send({ profile_id: 42 });
    expect(res.status).toBe(201);
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO world_events/.test(sql));
    const r = insert[1].replacements;
    expect(r.event_time).toBeNull();
    expect(r.dress_code).toBeNull();
    expect(r.cost_coins).toBe(300);
    expect(r.strictness).toBe(6);
    expect(r.deadline_type).toBe('medium');
    expect(JSON.parse(r.canon_consequences).automation).not.toHaveProperty('event_time');
  });
});

describe('spawnEventsFromCalendar (calendar auto-spawn)', () => {
  const cal = (extra = {}) => ({ id: 'cal-1', title: 'Fashion Week', cultural_category: 'fashion', severity_level: 5, ...extra });

  test('no event time on the column or the automation copy; everything else unchanged', async () => {
    const create = jest.fn(async (d) => ({ toJSON: () => d }));
    await spawnEventsFromCalendar(cal(), 'show-1', { WorldEvent: { create } });
    const data = create.mock.calls[0][0];
    expect(data.event_time).toBeNull();
    expect(data.dress_code).toBeNull();
    expect(data.canon_consequences.automation).not.toHaveProperty('event_time');
    // severity 5 + random 0 → prestige 5 → cost 150, strictness 5, deadline medium
    expect(data).toMatchObject({
      prestige: 5, cost_coins: 150, strictness: 5, deadline_type: 'medium',
      event_date: DATE(), status: 'ready', event_type: 'invite',
    });
    expect(data.canon_consequences.automation).toMatchObject({
      cost_coins: 150, strictness: 5, deadline_type: 'medium', event_date: DATE(), event_date_auto: DATE(),
      dress_code: null, source_calendar_event_id: 'cal-1',
    });
  });

  test('a dress code the calendar event supplies is still saved', async () => {
    const create = jest.fn(async (d) => ({ toJSON: () => d }));
    await spawnEventsFromCalendar(cal({ activities: { dress_code: 'black tie' } }), 'show-1', { WorldEvent: { create } });
    const data = create.mock.calls[0][0];
    expect(data.dress_code).toBe('black tie');
    expect(data.canon_consequences.automation.dress_code).toBe('black tie');
  });
});

function pipelineModels({ opportunity, parent } = {}) {
  const queries = [];
  return {
    queries,
    models: {
      sequelize: {
        query: jest.fn(async (sql, opts) => {
          queries.push({ sql, opts });
          if (/FROM opportunities WHERE id/.test(sql)) return [[opportunity]];
          if (/SELECT \* FROM world_events WHERE id/.test(sql)) return [[parent]];
          return [[]];
        }),
      },
    },
  };
}

const insertOf = (queries) => queries.find(q => /INSERT INTO world_events/.test(q.sql)).opts.replacements;

describe('scheduleOpportunityAsEvent (feed pipeline)', () => {
  const opp = (extra = {}) => ({
    id: 'opp-1', name: 'Runway Call', event_id: null, opportunity_type: 'runway',
    connector_profile_id: null, connector_handle: 'h', prestige: 7, wardrobe_brief: null, ...extra,
  });

  test('no automation.event_time; no type-default dress code; everything else unchanged', async () => {
    const { models, queries } = pipelineModels({ opportunity: opp() });
    await scheduleOpportunityAsEvent('opp-1', 'show-1', models);
    const r = insertOf(queries);
    expect(r.dress_code).toBeNull();
    expect(r).not.toHaveProperty('event_time');
    const auto = JSON.parse(r.canon_consequences).automation;
    expect(auto).not.toHaveProperty('event_time');
    expect(auto).toMatchObject({ event_date: DATE(), event_date_auto: DATE(), source: 'opportunity_pipeline' });
    expect(r).toMatchObject({ prestige: 7, cost_coins: 300, strictness: 8, deadline_type: 'medium', event_date: DATE() });
  });

  test("the opportunity's wardrobe_brief dress code is still saved", async () => {
    const { models, queries } = pipelineModels({ opportunity: opp({ wardrobe_brief: { dress_code: 'all white' } }) });
    await scheduleOpportunityAsEvent('opp-1', 'show-1', models);
    expect(insertOf(queries).dress_code).toBe('all white');
  });
});

describe('chainEventFromMomentum (feed pipeline)', () => {
  test('no type-default dress code; everything else unchanged', async () => {
    const parent = { id: 'p1', name: 'Parent', prestige: 6, host: 'H', canon_consequences: { automation: {} }, seeds_future_events: [] };
    const { models, queries } = pipelineModels({ parent });
    await chainEventFromMomentum('p1', { type: 'interview', reason: 'buzz' }, 'show-1', models);
    const r = insertOf(queries);
    expect(r.dress_code).toBeNull();
    expect(r).not.toHaveProperty('event_time');
    expect(JSON.parse(r.canon_consequences).automation).not.toHaveProperty('event_time');
    // parent 6 + 1 → prestige 7 → cost 300, strictness 8, deadline medium
    expect(r).toMatchObject({ prestige: 7, cost_coins: 300, strictness: 8, deadline_type: 'medium', event_date: DATE(), chain_position: 1 });
  });
});
