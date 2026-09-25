// ============================================================================
// Composition version history refuses with 501 while #1910 is undecided
// ============================================================================
// composition_versions is not in canon (2026-09-17 capture, FD31 prod dump, no
// live migration). Until Evoni rules between creating it and retiring it, the
// version-history routes answer 501 with a clear message instead of a 500 on a
// missing relation, VersioningService never queries the table, and
// FilterService.searchCompositions reports version_count / last_version_date as
// NULL (unknown), never a counted 0. The mocked pool fails every statement the
// way canon would ('relation "composition_versions" does not exist'), so on
// main these routes are 500s. Mocked pool, no database.

const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();
jest.mock('../../../src/db', () => ({ pool: { query: (...a) => mockQuery(...a) } }));
jest.mock('../../../src/models', () => ({ models: {} }));
jest.mock('../../../src/services/CompositionService', () => ({}));
jest.mock('../../../src/services/ThumbnailGeneratorService', () => ({}));
jest.mock('../../../src/middleware/jwtAuth', () => ({
  authenticateJWT: (_req, _res, next) => next(),
  requireGroup: () => (_req, _res, next) => next(),
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    requireAuth: (req, res, next) => {
      if (req.headers['x-test-auth'] === undefined) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: 'u1' };
      next();
    },
  };
});

const router = require('../../../src/routes/compositions');
const VersioningService = require('../../../src/services/VersioningService');
const FilterService = require('../../../src/services/FilterService');

const app = express();
app.use(express.json());
app.use('/api/v1/compositions', router);

const ID = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
const BASE = `/api/v1/compositions/${ID}`;
const UNDECIDED = /composition_versions table is not in the canon schema.*#1910/;

const missingRelation = () => {
  const err = new Error('relation "composition_versions" does not exist');
  err.code = '42P01';
  return err;
};

beforeEach(() => {
  mockQuery.mockReset().mockImplementation(async (sql) => {
    if (/composition_versions/.test(sql)) throw missingRelation();
    return { rows: [{ current_version: 1, total_count: '0' }] };
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('version-history routes answer 501, not 500, and never query the table', () => {
  test.each([
    ['GET history', 'get', `${BASE}/versions`],
    ['GET one version', 'get', `${BASE}/versions/2`],
    ['GET compare', 'get', `${BASE}/versions/1/compare/2`],
    ['POST revert', 'post', `${BASE}/revert/1`],
    ['GET version-stats', 'get', `${BASE}/version-stats`],
  ])('%s', async (_n, method, url) => {
    const res = await request(app)[method](url).set('x-test-auth', '1').send({ reason: 'test' });
    expect(res.status).toBe(501);
    expect(res.body.code).toBe('COMPOSITION_VERSIONS_UNDECIDED');
    expect(res.body.error).toMatch(UNDECIDED);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('revert writes nothing to thumbnail_compositions either', async () => {
    await request(app).post(`${BASE}/revert/1`).set('x-test-auth', '1').send({});
    expect(mockQuery.mock.calls.filter(([sql]) => /UPDATE thumbnail_compositions/.test(sql))).toEqual([]);
  });
});

describe('the guard sits behind auth and input validation', () => {
  test('unauthenticated caller is still 401', async () => {
    const res = await request(app).get(`${BASE}/versions`);
    expect(res.status).toBe(401);
  });

  test('a bad id is still 400', async () => {
    const res = await request(app).get('/api/v1/compositions/not-a-uuid/versions').set('x-test-auth', '1');
    expect(res.status).toBe(400);
  });

  test('a bad version number is still 400', async () => {
    const res = await request(app).get(`${BASE}/versions/0`).set('x-test-auth', '1');
    expect(res.status).toBe(400);
  });
});

describe('VersioningService refuses every method before touching the pool', () => {
  test.each([
    ['getVersionHistory', [ID]],
    ['getSpecificVersion', [ID, 1]],
    ['compareVersions', [ID, 1, 2]],
    ['revertToVersion', [ID, 1, 'u1', 'r']],
    ['getVersionStats', [ID]],
    ['getModifiedSince', [new Date('2026-01-01')]],
    ['cleanupOldVersions', [ID, 90]],
  ])('%s', async (method, args) => {
    await expect(VersioningService[method](...args)).rejects.toMatchObject({
      status: 501,
      code: 'COMPOSITION_VERSIONS_UNDECIDED',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('FilterService.searchCompositions stops querying composition_versions', () => {
  test('version columns are NULL (unknown), not a count, and the search succeeds', async () => {
    mockQuery.mockReset().mockImplementation(async (sql) => {
      if (/composition_versions/.test(sql)) throw missingRelation();
      if (/total_count/.test(sql)) return { rows: [{ total_count: '1' }] };
      return { rows: [{ id: ID, version_count: null, last_version_date: null }] };
    });
    const result = await FilterService.searchCompositions({ status: 'draft' });
    expect(result.status).toBe('SUCCESS');
    expect(mockQuery).toHaveBeenCalledTimes(2);
    for (const [sql] of mockQuery.mock.calls) expect(sql).not.toMatch(/composition_versions/);
    const [dataSql] = mockQuery.mock.calls[1];
    expect(dataSql).toMatch(/NULL::integer as version_count/);
    expect(dataSql).toMatch(/NULL::timestamp as last_version_date/);
    expect(dataSql).not.toMatch(/COUNT\(\*\)[\s\S]*as version_count/);
  });
});
