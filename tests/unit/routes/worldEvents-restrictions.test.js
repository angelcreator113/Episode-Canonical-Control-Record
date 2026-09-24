// ============================================================================
// Restrictions are their own term (Task #1814) — PUT /world/:showId/events/
// :eventId writes restrictions to world_events.restrictions, never into
// requirements (access requirements), per docs/EVENT_EPISODE_FLOW.md §8(t)
// item 1. Mocked, no database.
// ============================================================================

const express = require('express');
const request = require('supertest');

const SHOW = 'show-1';
const EV = 'ev-1';
const mockRows = {};
const mockCalls = [];

jest.mock('../../../src/models', () => ({
  sequelize: {
    query: jest.fn(async (sql, opts = {}) => {
      mockCalls.push({ sql, replacements: opts.replacements });
      const row = mockRows[opts.replacements?.eventId];
      if (/^SELECT \* FROM world_events/.test(sql)) return [row ? [{ ...row }] : []];
      if (/^UPDATE world_events SET /.test(sql)) {
        if (row) {
          for (const [k, v] of Object.entries(opts.replacements)) {
            if (!['eventId', 'showId'].includes(k)) row[k] = v;
          }
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

const app = express();
app.use(express.json());
app.use('/api/v1', router);

const updates = () => mockCalls.filter((c) => /^UPDATE world_events SET /.test(c.sql));
const put = (body) => request(app).put(`/api/v1/world/${SHOW}/events/${EV}`).send(body);

beforeEach(() => {
  mockCalls.length = 0;
  mockRows[EV] = { id: EV, show_id: SHOW, name: 'Gala', requirements: { reputation_min: 3 }, restrictions: [] };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('PUT /world/:showId/events/:eventId — restrictions (Task #1814)', () => {
  test('restrictions and requirements are written to their own columns', async () => {
    const res = await put({
      restrictions: [{ type: 'exclusivity', description: 'No rival brands for 90 days' }],
      requirements: { reputation_min: 4, coins_min: 100 },
    });
    expect(res.status).toBe(200);
    expect(updates()).toHaveLength(1);
    const { sql, replacements } = updates()[0];
    expect(sql).toMatch(/restrictions = :restrictions/);
    expect(sql).toMatch(/requirements = :requirements/);
    expect(JSON.parse(replacements.restrictions)).toEqual([{ type: 'exclusivity', description: 'No rival brands for 90 days' }]);
    expect(JSON.parse(replacements.requirements)).toEqual({ reputation_min: 4, coins_min: 100 });
    expect(JSON.parse(replacements.requirements)).not.toHaveProperty('restrictions');
  });

  test('restrictions alone leaves requirements untouched', async () => {
    const res = await put({ restrictions: ['No competing launches'] });
    expect(res.status).toBe(200);
    const { sql, replacements } = updates()[0];
    expect(sql).not.toMatch(/requirements/);
    expect(replacements).not.toHaveProperty('requirements');
    // A bare string is normalised to { type: 'other', description }.
    expect(JSON.parse(replacements.restrictions)).toEqual([{ type: 'other', description: 'No competing launches' }]);
  });

  test('restrictions that are not an array are refused with 400 and nothing is written', async () => {
    const res = await put({ restrictions: { exclusivity: 'x' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid value for restrictions');
    expect(updates()).toHaveLength(0);
  });

  test('restrictions: null clears the column', async () => {
    const res = await put({ restrictions: null });
    expect(res.status).toBe(200);
    expect(updates()[0].replacements.restrictions).toBeNull();
  });

  test('compensation saves through the same PUT: is_paid and payment_amount', async () => {
    const res = await put({ is_paid: true, payment_amount: 1500 });
    expect(res.status).toBe(200);
    const { sql, replacements } = updates()[0];
    expect(sql).toMatch(/is_paid = :is_paid/);
    expect(sql).toMatch(/payment_amount = :payment_amount/);
    expect(replacements).toMatchObject({ is_paid: true, payment_amount: 1500 });
  });
});
