// ============================================================================
// Show episode counts exclude soft-deleted episodes (Task #1825).
// Mocked, no database. Episode is paranoid:false (manual soft delete via
// deleted_at), so the fake below applies only the where clause the route
// passes — a count that omits deleted_at counts deleted rows, as Postgres would.
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockEpisodes = [];
const mockShowCreate = jest.fn(async (row) => row);

const mockMatches = (ep, where) => Object.entries(where).every(([k, v]) => {
  if (Array.isArray(v)) return v.includes(ep[k]);
  return (ep[k] ?? null) === v;
});

jest.mock('../../../src/models', () => ({
  Show: {
    findAll: jest.fn(async () => [{ id: 'show-a', name: 'Styling Adventures with Lala' }, { id: 'show-b', name: 'Empty' }]),
    findByPk: jest.fn(async () => null),
    create: (...args) => mockShowCreate(...args),
  },
  Episode: {
    findAll: jest.fn(async ({ where }) => {
      const counts = {};
      mockEpisodes.filter((ep) => mockMatches(ep, where)).forEach((ep) => {
        counts[ep.show_id] = (counts[ep.show_id] || 0) + 1;
      });
      return Object.entries(counts).map(([show_id, n]) => ({ show_id, episodeCount: String(n) }));
    }),
    count: jest.fn(async ({ where }) => mockEpisodes.filter((ep) => mockMatches(ep, where)).length),
  },
  sequelize: { query: jest.fn(async () => []), QueryTypes: { SELECT: 'SELECT' } },
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/shows');

const app = express();
app.use(express.json());
app.use('/api/v1/shows', router);

beforeEach(() => {
  mockEpisodes.length = 0;
  mockShowCreate.mockClear();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('GET /api/v1/shows — episodeCount', () => {
  it('counts only live episodes (2 live + 1 soft-deleted → 2)', async () => {
    mockEpisodes.push(
      { id: 'e1', show_id: 'show-a', deleted_at: null },
      { id: 'e2', show_id: 'show-a', deleted_at: null },
      { id: 'e3', show_id: 'show-a', deleted_at: new Date('2026-09-20T00:00:00Z') },
    );
    const res = await request(app).get('/api/v1/shows');
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.data.map((s) => [s.id, s.episodeCount]));
    expect(byId['show-a']).toBe(2);
    expect(byId['show-b']).toBe(0);
  });

  it('reports 0 when every episode is soft-deleted', async () => {
    mockEpisodes.push(
      { id: 'e1', show_id: 'show-a', deleted_at: new Date('2026-09-20T00:00:00Z') },
      { id: 'e2', show_id: 'show-a', deleted_at: new Date('2026-09-20T00:00:00Z') },
    );
    const res = await request(app).get('/api/v1/shows');
    expect(res.body.data.find((s) => s.id === 'show-a').episodeCount).toBe(0);
  });
});

describe('GET /api/v1/shows/:id — auto-create from episodes', () => {
  it('does not recreate a missing show when its only episodes are soft-deleted', async () => {
    mockEpisodes.push({ id: 'e1', show_id: 'gone-show-0001', deleted_at: new Date('2026-09-20T00:00:00Z') });
    const res = await request(app).get('/api/v1/shows/gone-show-0001');
    expect(res.status).toBe(404);
    expect(mockShowCreate).not.toHaveBeenCalled();
  });

  it('still recreates a missing show that has a live episode', async () => {
    mockEpisodes.push({ id: 'e1', show_id: 'live-show-0001', deleted_at: null });
    const res = await request(app).get('/api/v1/shows/live-show-0001');
    expect(res.status).toBe(200);
    expect(mockShowCreate).toHaveBeenCalledTimes(1);
  });
});
