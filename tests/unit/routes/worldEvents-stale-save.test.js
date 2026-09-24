// ============================================================================
// Refuse a stale event save (Task #1788) — PUT /world/:showId/events/:eventId.
// Mocked, no database. The stored row's updated_at is parsed by the real
// postgres-date from a microsecond string, exactly as node-postgres hands it
// to the route in production.
// ============================================================================

const express = require('express');
const request = require('supertest');
const parsePgDate = require('postgres-date');

const SHOW = 'show-1';
const EV = 'ev-1';
const STORED_MICROS = '2026-09-24 15:00:00.123456+00'; // what Postgres stores
const READ_VERSION = '2026-09-24T15:00:00.123Z';       // what the client received as JSON

const mockRows = {};
const mockCalls = [];

jest.mock('../../../src/models', () => ({
  sequelize: {
    query: jest.fn(async (sql, opts = {}) => {
      mockCalls.push({ sql, replacements: opts.replacements, inTx: !!opts.transaction });
      const id = opts.replacements?.eventId;
      const row = mockRows[id];
      if (/^SELECT canon_consequences, updated_at FROM world_events .* FOR UPDATE$/.test(sql)) {
        return [row ? [{ canon_consequences: row.canon_consequences, updated_at: row.updated_at }] : []];
      }
      if (/^SELECT updated_at FROM world_events/.test(sql)) return [row ? [{ updated_at: row.updated_at }] : []];
      if (/^SELECT \* FROM world_events/.test(sql)) return [row ? [{ ...row }] : []];
      if (/^UPDATE world_events SET /.test(sql)) {
        if (row) {
          for (const [k, v] of Object.entries(opts.replacements)) {
            if (!['eventId', 'showId'].includes(k)) row[k] = v;
          }
          row.updated_at = new Date('2026-09-24T15:05:00.000Z');
        }
        return [[]];
      }
      return [[]];
    }),
    transaction: jest.fn(async (fn) => fn({ id: 'tx' })),
  },
  SceneSet: { findByPk: jest.fn() },
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/worldEvents');
const { STALE_SAVE_CODE, STALE_SAVE_MESSAGE } = require('../../../src/utils/eventVersion');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

const updates = () => mockCalls.filter((c) => /^UPDATE world_events SET /.test(c.sql));
const put = (body) => request(app).put(`/api/v1/world/${SHOW}/events/${EV}`).send(body);

beforeEach(() => {
  mockCalls.length = 0;
  mockRows[EV] = {
    id: EV, show_id: SHOW, name: 'Gala', updated_at: parsePgDate(STORED_MICROS),
    canon_consequences: { invitation_text: 'NEW invite', automation: { guest_profiles: [{ profile_id: 'g1', featured: true }] } },
  };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('PUT /world/:showId/events/:eventId — stale-save check', () => {
  test('a save with the current version succeeds, inside the locked transaction', async () => {
    const res = await put({ name: 'Gala Night', expected_updated_at: READ_VERSION });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event.name).toBe('Gala Night');
    expect(res.body.event.updated_at).toBe('2026-09-24T15:05:00.000Z');
    const lock = mockCalls.find((c) => /FOR UPDATE$/.test(c.sql));
    expect(lock.inTx).toBe(true);
    expect(updates()).toHaveLength(1);
    expect(updates()[0].inTx).toBe(true);
  });

  test('a save with an older version is refused with 409 and writes nothing', async () => {
    const res = await put({ name: 'Gala Night', expected_updated_at: '2026-09-24T14:59:59.000Z' });
    expect(res.status).toBe(409);
    expect(updates()).toHaveLength(0);
    expect(mockRows[EV].name).toBe('Gala');
  });

  test('the refusal carries enough for the client to explain itself and recover', async () => {
    const res = await put({ name: 'Gala Night', expected_updated_at: '2026-09-24T14:59:59.000Z' });
    expect(res.body).toMatchObject({
      success: false,
      code: STALE_SAVE_CODE,
      error: STALE_SAVE_MESSAGE,
      expected_updated_at: '2026-09-24T14:59:59.000Z',
      current_updated_at: READ_VERSION,
    });
    expect(res.body.event).toMatchObject({ id: EV, name: 'Gala' });
  });

  test('a stale guest save cannot overwrite canon_consequences', async () => {
    const res = await put({
      canon_consequences: { automation: { guest_profiles: [{ profile_id: 'g1', featured: false }] } },
      expected_updated_at: '2026-09-24T14:00:00.000Z',
    });
    expect(res.status).toBe(409);
    expect(updates()).toHaveLength(0);
    expect(mockRows[EV].canon_consequences.automation.guest_profiles[0].featured).toBe(true);
  });

  test('a millisecond version matches a microsecond row; one millisecond off does not', async () => {
    expect((await put({ name: 'A', expected_updated_at: '2026-09-24T15:00:00.123Z' })).status).toBe(200);
    mockRows[EV].updated_at = parsePgDate('2026-09-24 15:00:00.999999+00');
    expect((await put({ name: 'B', expected_updated_at: '2026-09-24T15:00:00.999Z' })).status).toBe(200);
    mockRows[EV].updated_at = parsePgDate(STORED_MICROS);
    expect((await put({ name: 'C', expected_updated_at: '2026-09-24T15:00:00.124Z' })).status).toBe(409);
  });

  test('a save with no version keeps last-write-wins (optional check)', async () => {
    const res = await put({ name: 'Gala Night' });
    expect(res.status).toBe(200);
    expect(updates()).toHaveLength(1);
    expect(mockCalls.some((c) => /FOR UPDATE$/.test(c.sql))).toBe(false);
  });

  test('a version that is not a date is a 400, and nothing is written', async () => {
    const res = await put({ name: 'Gala Night', expected_updated_at: 'yesterday-ish' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_EXPECTED_UPDATED_AT');
    expect(updates()).toHaveLength(0);
  });

  test('a versioned save to a missing event is a 404, not a 409', async () => {
    delete mockRows[EV];
    const res = await put({ name: 'Gala Night', expected_updated_at: READ_VERSION });
    expect(res.status).toBe(404);
    expect(updates()).toHaveLength(0);
  });
});
