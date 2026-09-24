// ============================================================================
// Task #1771 — calendar auto-spawn: a sponsor is not an organizer.
// Mocked models, no database.
// ============================================================================
// spawnEventsFromCalendar (src/services/eventAutomationService.js) used to
// write the matched host creator's first brand partnership to the host_brand
// column AND canon_consequences.automation.host_brand — the same bug #1766
// fixed for POST /world/:showId/events/from-profile. resolveEventOrganizer
// (frontend/src/utils/eventReadiness.js) lets a brand in either home win over
// the creator, so the Event Package read "Organized by <sponsor>".
// Now: the creator stays the organizer (automation.host_* copy), host_brand is
// null in both homes, the well-formed partnerships are kept as
// automation.brand_partnerships, and the sponsor still appears in the social
// task copy (buildSocialTasks' context), which is sponsor text, not an
// organizer field.

const mockBuildSocialTasks = jest.fn(() => []);
jest.mock('../../../src/services/episodeGeneratorService', () => ({
  buildSocialTasks: (...a) => mockBuildSocialTasks(...a),
}));

const { spawnEventsFromCalendar } = require('../../../src/services/eventAutomationService');

beforeEach(() => {
  mockBuildSocialTasks.mockClear();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// Same rule as resolveEventOrganizer (an ES module the backend jest config
// does not transform, so it is mirrored here, as in the from-profile test):
// a brand in either home wins, else the creator.
function organizerOf(ev) {
  const auto = ev.canon_consequences?.automation || {};
  const hasCreator = !!(ev.source_profile_id || auto.host_profile_id);
  const brandName = ev.host_brand || auto.host_brand || null;
  return brandName ? { kind: 'brand', name: brandName } : (hasCreator ? { kind: 'creator', name: auto.host_display_name || ev.host } : null);
}

const cal = (extra = {}) => ({ id: 'cal-1', title: 'Fashion Week', cultural_category: 'fashion', severity_level: 5, ...extra });

const baseHost = () => ({
  id: 42, handle: 'hosty', display_name: 'Hosty', content_category: 'fashion', archetype: 'soft_life',
  follower_tier: 'macro', lala_relevance_score: 5, registry_character_id: 'rc-7', platform: 'instagram',
  brand_partnerships: [], city: null, frequent_venues: [],
});

// SocialProfile.findAll: the first call is findHostProfile's candidate list;
// later calls (assembleGuestList's candidate pool) find nobody.
function modelsWith(host, { createFails = false } = {}) {
  const create = jest.fn(async (d) => {
    if (createFails) throw new Error('create failed');
    return { toJSON: () => d };
  });
  const query = jest.fn(async () => [[]]);
  let call = 0;
  const findAll = jest.fn(async () => (call++ === 0 && host ? [host] : []));
  return {
    create, query,
    models: { WorldEvent: { create }, SocialProfile: { findAll }, sequelize: { query } },
  };
}

// Automation keys a spawned event carries when the host has no partnerships
// (identical to the basis: #1771 adds only brand_partnerships, and only when
// there is one).
const AUTO_KEYS = [
  'cost_coins', 'deadline_type', 'dress_code', 'event_date', 'event_date_auto', 'guest_profiles',
  'host_brand', 'host_display_name', 'host_handle', 'host_profile_id', 'host_registry_character_id',
  'social_tasks', 'source_calendar_event_id', 'source_calendar_title', 'automated_at',
  'strictness', 'venue_address', 'venue_location_id', 'venue_name',
].sort();

describe('spawnEventsFromCalendar — a sponsor is not the organizer', () => {
  test('a host with brand partnerships: creator is the organizer, host_brand null in both homes', async () => {
    const host = baseHost();
    host.brand_partnerships = [{ brand: 'Velour', type: 'ambassador' }, { brand: 'Ori Beauty', type: 'gifted' }];
    const { models, create } = modelsWith(host);
    await spawnEventsFromCalendar(cal(), 'show-1', models);
    const data = create.mock.calls[0][0];
    const auto = data.canon_consequences.automation;

    expect(data.host_brand).toBeNull();
    expect(auto.host_brand).toBeNull();
    expect(data.host).toBe('Hosty');
    expect(auto).toMatchObject({ host_profile_id: 42, host_handle: 'hosty', host_display_name: 'Hosty', host_registry_character_id: 'rc-7' });
    expect(organizerOf(data)).toEqual({ kind: 'creator', name: 'Hosty' });

    // The sponsor is kept, outside the organizer fields.
    expect(auto.brand_partnerships).toEqual(host.brand_partnerships);
    expect(Object.keys(auto).sort()).toEqual([...AUTO_KEYS, 'brand_partnerships'].sort());
  });

  test('the social task copy still names the sponsor (sponsor text, not an organizer field)', async () => {
    const host = baseHost();
    host.brand_partnerships = [{ brand: 'Velour' }];
    const { models } = modelsWith(host);
    await spawnEventsFromCalendar(cal(), 'show-1', models);
    expect(mockBuildSocialTasks).toHaveBeenCalledTimes(1);
    const context = mockBuildSocialTasks.mock.calls[0][3];
    expect(context).toMatchObject({ host_name: 'Hosty', host_handle: 'hosty', host_brand: 'Velour' });
  });

  test('raw SQL fallback (no WorldEvent model) binds host_brand null in both homes', async () => {
    const host = baseHost();
    host.brand_partnerships = [{ brand: 'Velour' }];
    const { models, query } = modelsWith(host);
    delete models.WorldEvent;
    await spawnEventsFromCalendar(cal(), 'show-1', models);
    const insert = query.mock.calls.find(([sql]) => /INSERT INTO world_events/.test(sql));
    const r = insert[1].replacements;
    expect(r.host_brand).toBeNull();
    const auto = JSON.parse(r.canon_consequences).automation;
    expect(auto.host_brand).toBeNull();
    expect(auto.brand_partnerships).toEqual([{ brand: 'Velour' }]);
  });

  test('last-resort minimal INSERT (create throws) carries no brand in automation either', async () => {
    const host = baseHost();
    host.brand_partnerships = [{ brand: 'Velour' }];
    const { models, query } = modelsWith(host, { createFails: true });
    await spawnEventsFromCalendar(cal(), 'show-1', models);
    const insert = query.mock.calls.find(([sql]) => /INSERT INTO world_events/.test(sql));
    const r = insert[1].replacements;
    expect(r).not.toHaveProperty('host_brand');
    expect(JSON.parse(r.canon_consequences).automation.host_brand).toBeNull();
  });

  test('malformed partnership entries are not copied into automation.brand_partnerships', async () => {
    const host = baseHost();
    // No null entry: findHostProfile's scoring already reads b.brand on
    // every entry, so a null would throw there before this code runs.
    host.brand_partnerships = ['Velour', { type: 'gifted' }, { brand: 'Ori Beauty' }];
    const { models, create } = modelsWith(host);
    await spawnEventsFromCalendar(cal(), 'show-1', models);
    const data = create.mock.calls[0][0];
    expect(data.canon_consequences.automation.brand_partnerships).toEqual([{ brand: 'Ori Beauty' }]);
    expect(data.host_brand).toBeNull();
  });

  test('a host without partnerships: same automation keys as before, no brand anywhere', async () => {
    const { models, create } = modelsWith(baseHost());
    await spawnEventsFromCalendar(cal(), 'show-1', models);
    const data = create.mock.calls[0][0];
    const auto = data.canon_consequences.automation;
    expect(Object.keys(auto).sort()).toEqual(AUTO_KEYS);
    expect(data.host_brand).toBeNull();
    expect(auto.host_brand).toBeNull();
    expect(mockBuildSocialTasks.mock.calls[0][3].host_brand).toBeNull();
    expect(organizerOf(data)).toEqual({ kind: 'creator', name: 'Hosty' });
    // Everything else as asserted by eventCreation-noDerivedValues.test.js.
    expect(data).toMatchObject({ prestige: 5, cost_coins: 150, strictness: 5, deadline_type: 'medium', status: 'ready', event_type: 'invite' });
  });

  test('no host found: no organizer, no brand', async () => {
    const { models, create } = modelsWith(null);
    await spawnEventsFromCalendar(cal(), 'show-1', models);
    const data = create.mock.calls[0][0];
    expect(data.host).toBeNull();
    expect(data.host_brand).toBeNull();
    expect(data.canon_consequences.automation.host_brand).toBeNull();
    expect(data.canon_consequences.automation).not.toHaveProperty('brand_partnerships');
    expect(organizerOf(data)).toBeNull();
  });
});

// ── A brand that genuinely organizes a calendar event ──────────────────────
// Evoni: "a brand that genuinely organizes a calendar event should stay the
// organizer. Only a sponsor lifted from a creator's partnerships is the bug."
// A calendar event (StoryCalendarEvent) has no brand, host, organizer or
// sponsor attribute, so the auto-spawn path has no calendar-side organizer
// brand to keep. The one calendar-to-world-event path that takes an explicit
// organizer brand is POST /calendar/events/:id/spawn-world-event, which
// writes req.body.host_brand as the organizer; #1771 does not touch it, and
// it still keeps a brand the caller names there.
describe('a brand that genuinely organizes a calendar event', () => {
  test('StoryCalendarEvent carries no brand/host/organizer/sponsor field for spawn to read', () => {
    const { Sequelize, DataTypes } = require('sequelize');
    // Constructing a Sequelize instance does not connect.
    const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/none', { logging: false });
    const StoryCalendarEvent = require('../../../src/models/StoryCalendarEvent')(sequelize, DataTypes);
    const attrs = Object.keys(StoryCalendarEvent.rawAttributes);
    expect(attrs).toContain('title');
    expect(attrs.filter((a) => /brand|host|organi[sz]er|sponsor/i.test(a))).toEqual([]);
  });

  test('spawn-world-event keeps an explicitly named organizer brand in host_brand', async () => {
    const express = require('express');
    const request = require('supertest');
    jest.resetModules();
    jest.doMock('../../../src/middleware/auth', () => ({
      requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); },
      optionalAuth: (_req, _res, next) => next(),
    }));
    jest.doMock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
    const router = require('../../../src/routes/calendarRoutes');
    const created = [];
    const models = {
      StoryCalendarEvent: { findByPk: jest.fn(async () => ({ id: 'cal-1', title: 'Velour Atelier Launch', event_type: 'world_event', severity_level: 6 })) },
      WorldEvent: { create: jest.fn(async (d) => { created.push(d); return { toJSON: () => d }; }) },
      sequelize: { query: jest.fn(async () => [[]]) },
    };
    const app = express();
    app.use(express.json());
    app.set('models', models);
    app.use('/api/v1/calendar', router);

    const res = await request(app)
      .post('/api/v1/calendar/events/cal-1/spawn-world-event')
      .send({ show_id: 'show-1', host_brand: 'Velour Atelier' });
    expect(res.status).toBe(201);
    expect(created).toHaveLength(1);
    expect(created[0].host_brand).toBe('Velour Atelier');
    expect(organizerOf(created[0])).toEqual({ kind: 'brand', name: 'Velour Atelier' });
  });
});
