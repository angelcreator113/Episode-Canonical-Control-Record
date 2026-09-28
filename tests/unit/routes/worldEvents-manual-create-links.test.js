// ============================================================================
// Task #2158 — manual create (POST /world/:showId/events) saves the venue and
// creator links when the request sends them, and QuickEpisodeCreator sends
// its cost as cost_coins. Mocked models, no database.
//   - venue_location_id is saved when it names an existing WorldLocation
//     (the lookup the route already made for the venue name).
//   - source_profile_id is saved when it names an existing SocialProfile;
//     an unknown one is ignored and the event still saves.
//   - A request with neither saves exactly as before, on the model path and
//     on the raw-SQL fallback.
// ============================================================================

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const mockCreate = jest.fn(async (data) => ({ toJSON: () => ({ id: 'ev-new', ...data }) }));
const mockLocFind = jest.fn();
const mockProfileFind = jest.fn();
const mockQuery = jest.fn(async () => [[{ id: 'ev-sql' }]]);
// Toggled per test: false exercises the route's raw-SQL fallback.
let mockHasWorldEventModel = true;

jest.mock('../../../src/models', () => ({
  sequelize: { query: (...a) => mockQuery(...a) },
  get WorldEvent() { return mockHasWorldEventModel ? { create: (...a) => mockCreate(...a) } : undefined; },
  WorldLocation: { findByPk: (...a) => mockLocFind(...a) },
  SocialProfile: { findByPk: (...a) => mockProfileFind(...a) },
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

const post = (body) => request(app).post('/api/v1/world/show-1/events').send(body);
const created = () => mockCreate.mock.calls[0][0];
const insert = () => mockQuery.mock.calls.find(([sql]) => /INSERT INTO world_events/.test(sql));

beforeEach(() => {
  mockHasWorldEventModel = true;
  mockCreate.mockClear();
  mockQuery.mockClear();
  mockLocFind.mockReset();
  mockProfileFind.mockReset();
  mockLocFind.mockResolvedValue({ id: 'loc-1', name: 'Club Noir', street_address: '1 Main St', district: null, city: 'Velour City' });
  mockProfileFind.mockResolvedValue({ id: 7 });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('venue_location_id', () => {
  test('saved when sent and the venue exists', async () => {
    const res = await post({ name: 'Soiree', venue_location_id: 'loc-1' });
    expect(res.status).toBe(201);
    expect(created().venue_location_id).toBe('loc-1');
    expect(created().location_hint).toBe('1 Main St, Velour City');
  });

  test('absent when not sent', async () => {
    await post({ name: 'Soiree' });
    expect(created()).not.toHaveProperty('venue_location_id');
    expect(mockLocFind).not.toHaveBeenCalled();
  });

  test('not saved when it names no venue; the event still saves', async () => {
    mockLocFind.mockResolvedValue(null);
    const res = await post({ name: 'Soiree', venue_location_id: 'loc-missing' });
    expect(res.status).toBe(201);
    expect(created()).not.toHaveProperty('venue_location_id');
  });
});

describe('source_profile_id', () => {
  test('a valid one is saved (looked up by primary key)', async () => {
    const res = await post({ name: 'Soiree', source_profile_id: 7 });
    expect(res.status).toBe(201);
    expect(mockProfileFind).toHaveBeenCalledWith(7, { attributes: ['id'] });
    expect(created().source_profile_id).toBe(7);
  });

  test('an unknown one is ignored and the event still saves', async () => {
    mockProfileFind.mockResolvedValue(null);
    const res = await post({ name: 'Soiree', source_profile_id: 999 });
    expect(res.status).toBe(201);
    expect(created()).not.toHaveProperty('source_profile_id');
    expect(created().name).toBe('Soiree');
  });

  test('a failed lookup is ignored and the event still saves', async () => {
    mockProfileFind.mockRejectedValue(new Error('db down'));
    const res = await post({ name: 'Soiree', source_profile_id: 7 });
    expect(res.status).toBe(201);
    expect(created()).not.toHaveProperty('source_profile_id');
  });
});

describe('a request with neither saves exactly as before', () => {
  test('model path: no link keys and no lookups', async () => {
    await post({ name: 'Soiree', prestige: 6 });
    const data = created();
    expect(data).not.toHaveProperty('venue_location_id');
    expect(data).not.toHaveProperty('source_profile_id');
    expect(mockProfileFind).not.toHaveBeenCalled();
    expect(data).toMatchObject({ name: 'Soiree', prestige: 6, cost_coins: 100, status: 'draft' });
  });

  test('raw-SQL fallback: the statement has no link columns', async () => {
    mockHasWorldEventModel = false;
    const res = await post({ name: 'Soiree' });
    expect(res.status).toBe(201);
    const [sql, { replacements }] = insert();
    expect(sql).not.toMatch(/venue_location_id|source_profile_id/);
    expect(replacements).not.toHaveProperty('venue_location_id');
    expect(replacements).not.toHaveProperty('source_profile_id');
    expect(sql).toMatch(/:chain_reason,\s*'draft', NOW\(\), NOW\(\)\)/);
  });

  test('raw-SQL fallback: both links saved when sent', async () => {
    mockHasWorldEventModel = false;
    await post({ name: 'Soiree', venue_location_id: 'loc-1', source_profile_id: 7 });
    const [sql, { replacements }] = insert();
    expect(sql).toMatch(/chain_reason, venue_location_id, source_profile_id,\s*status/);
    expect(sql).toMatch(/:chain_reason, :venue_location_id, :source_profile_id,\s*'draft'/);
    expect(replacements).toMatchObject({ venue_location_id: 'loc-1', source_profile_id: 7 });
  });
});

describe('QuickEpisodeCreator sends its cost as cost_coins (source check)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'components', 'QuickEpisodeCreator.jsx'), 'utf8');
  // The two POST /world/:showId/events bodies (edit mode with no event yet, and create mode).
  const createBodies = src.split('api.post(`/api/v1/world/${effectiveShowId}/events`, {').slice(1).map((s) => s.slice(0, s.indexOf('});')));

  test('both create bodies carry cost_coins and no cost key', () => {
    expect(createBodies).toHaveLength(2);
    for (const body of createBodies) {
      expect(body).toMatch(/\bcost_coins: isFree \? 0 : cost,/);
      expect(body).not.toMatch(/^\s*cost:/m);
    }
  });

  test('the route reads cost_coins with a default of 100 when absent', async () => {
    await post({ name: 'Soiree', cost_coins: 50 });
    expect(created().cost_coins).toBe(50);
    mockCreate.mockClear();
    await post({ name: 'Soiree' });
    expect(created().cost_coins).toBe(100);
  });
});
