// ============================================================================
// Event Package Basics (Task #1755) — route side. Mocked, no database.
// ============================================================================
// POST /world/:showId/events: a date or time typed into the create form is
// kept (the route used to discard both); with no date the event is
// auto-scheduled 45 days out and flagged in automation.event_date_auto.
// GET /world/:showId/events/:eventId: returns the linked venue's type and
// dress code for the Event Package's dress-code suggestion.
// PUT allowlist: every Basics column is writable through the existing route.

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const SHOW = 'show-1';
const mockCreate = jest.fn(async (data) => ({ toJSON: () => ({ id: 'ev-new', ...data }) }));
const mockLocFind = jest.fn();
const mockRows = {};

jest.mock('../../../src/models', () => ({
  sequelize: {
    query: jest.fn(async (sql, opts = {}) => {
      if (/^SELECT \* FROM world_events WHERE id = :eventId AND show_id = :showId/.test(sql)) {
        const ev = mockRows[opts.replacements.eventId];
        return [ev ? [ev] : []];
      }
      return [[]];
    }),
  },
  WorldEvent: { create: (...a) => mockCreate(...a) },
  WorldLocation: { findByPk: (...a) => mockLocFind(...a) },
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/worldEvents');
const { autoScheduledEventDate } = require('../../../src/utils/eventDateDefault');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

beforeEach(() => {
  mockCreate.mockClear();
  mockLocFind.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('POST /world/:showId/events — date and time', () => {
  test('no date → 45 days out, flagged; other automation keys kept', async () => {
    const res = await request(app).post(`/api/v1/world/${SHOW}/events`)
      .send({ name: 'Soiree', canon_consequences: { automation: { guest_profiles: [{ profile_id: 1 }] } } });
    expect(res.status).toBe(201);
    const data = mockCreate.mock.calls[0][0];
    const expected = autoScheduledEventDate();
    expect(data.event_date).toBe(expected);
    expect(data.event_time).toBeNull();
    expect(data.canon_consequences.automation).toEqual({ guest_profiles: [{ profile_id: 1 }], event_date_auto: expected });
  });

  test('a typed date and time are kept, and nothing is flagged', async () => {
    await request(app).post(`/api/v1/world/${SHOW}/events`)
      .send({ name: 'Soiree', event_date: '2026-10-31', event_time: '21:00' });
    const data = mockCreate.mock.calls[0][0];
    expect(data.event_date).toBe('2026-10-31');
    expect(data.event_time).toBe('21:00');
    expect(data.canon_consequences.automation).toBeUndefined();
  });

  test('the create form\'s empty strings count as not typed', async () => {
    await request(app).post(`/api/v1/world/${SHOW}/events`)
      .send({ name: 'Soiree', event_date: '', event_time: '' });
    const data = mockCreate.mock.calls[0][0];
    expect(data.event_date).toBe(autoScheduledEventDate());
    expect(data.event_time).toBeNull();
  });

  test('no time or dress code is derived at creation', async () => {
    await request(app).post(`/api/v1/world/${SHOW}/events`).send({ name: 'Soiree', format: 'gala', prestige: 9 });
    const data = mockCreate.mock.calls[0][0];
    expect(data.event_time).toBeNull();
    expect(data.dress_code).toBeNull();
  });
});

describe('GET /world/:showId/events/:eventId — venueLocation', () => {
  test('returns the linked venue\'s type and dress code', async () => {
    mockRows['ev-1'] = { id: 'ev-1', show_id: SHOW, venue_location_id: 'loc-1', canon_consequences: {} };
    mockLocFind.mockResolvedValue({ id: 'loc-1', name: 'Club Noir', venue_type: 'club', venue_details: { dress_code: ' all black ', hours: '9-2' } });
    const res = await request(app).get(`/api/v1/world/${SHOW}/events/ev-1`);
    expect(res.status).toBe(200);
    expect(res.body.venueLocation).toEqual({ id: 'loc-1', name: 'Club Noir', venue_type: 'club', dress_code: 'all black' });
  });

  test('null with no linked venue', async () => {
    mockRows['ev-2'] = { id: 'ev-2', show_id: SHOW, venue_location_id: null, canon_consequences: {} };
    const res = await request(app).get(`/api/v1/world/${SHOW}/events/ev-2`);
    expect(res.body.venueLocation).toBeNull();
    expect(mockLocFind).not.toHaveBeenCalled();
  });
});

describe('PUT allowlist covers the Basics columns', () => {
  test('event_date, event_time, description, dress_code, canon_consequences', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'worldEvents.js'), 'utf8');
    const allowed = src.match(/const allowedFields = \[[\s\S]*?\];/)[0];
    for (const f of ['event_date', 'event_time', 'description', 'dress_code', 'canon_consequences']) {
      expect(allowed).toContain(`'${f}'`);
    }
  });
});
