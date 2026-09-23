// ============================================================================
// GET /api/v1/compositions/search/filters/options — bound parameters (#1717)
// ============================================================================
// episodeId is validated as a UUID in the route (400 otherwise) and bound as
// $1 in all five statements; it never enters the SQL text. searchCompositions'
// format filter is bound too. Mocked pool, no database.

const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();
jest.mock('../../../src/db', () => ({ pool: { query: (...a) => mockQuery(...a) } }));
jest.mock('../../../src/models', () => ({ models: {} }));
jest.mock('../../../src/services/CompositionService', () => ({}));
jest.mock('../../../src/services/ThumbnailGeneratorService', () => ({}));
jest.mock('../../../src/services/VersioningService', () => ({}));
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
      req.user = { id: 'u1', groups: ['editor'] };
      next();
    },
  };
});

const router = require('../../../src/routes/compositions');
const FilterService = require('../../../src/services/FilterService');

const app = express();
app.use(express.json());
app.use('/api/v1/compositions', router);

const EPISODE = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
const URL = '/api/v1/compositions/search/filters/options';
const get = (qs = '') => request(app).get(URL + qs).set('x-test-auth', '1');

// One canned result per statement, told apart by the column each selects.
const rowsFor = (sql) => {
  if (/as format/.test(sql)) return { rows: [{ format: '"youtube"' }, { format: null }] };
  if (/DISTINCT status/.test(sql)) return { rows: [{ status: 'draft' }] };
  if (/DISTINCT template_id/.test(sql)) return { rows: [{ template_id: 't1' }] };
  if (/DISTINCT created_by/.test(sql)) return { rows: [{ created_by: 'evoni' }] };
  if (/earliest_date/.test(sql)) return { rows: [{ earliest_date: '2026-01-01', latest_date: '2026-09-23' }] };
  return { rows: [] };
};

const EXPECTED = {
  status: 'SUCCESS',
  data: {
    formats: ['"youtube"'],
    statuses: ['draft'],
    templates: ['t1'],
    creators: ['evoni'],
    date_range: { earliest_date: '2026-01-01', latest_date: '2026-09-23' },
  },
};

beforeEach(() => {
  mockQuery.mockReset().mockImplementation(async (sql) => rowsFor(sql));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('valid episodeId', () => {
  test('returns the same shape, with the id bound as $1 in all five statements', async () => {
    const res = await get(`?episodeId=${EPISODE}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(EXPECTED);
    expect(mockQuery).toHaveBeenCalledTimes(5);
    for (const [sql, params] of mockQuery.mock.calls) {
      expect(params).toEqual([EPISODE]);
      expect(sql).toMatch(/AND tc\.episode_id = \$1/);
      expect(sql).toMatch(/FROM thumbnail_compositions tc\b/); // the alias the filter needs
      expect(sql).not.toContain(EPISODE);
    }
  });
});

describe('absent episodeId behaves as before', () => {
  test.each([['no parameter', ''], ['empty value', '?episodeId=']])('%s: no filter, no bound values', async (_n, qs) => {
    const res = await get(qs);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(EXPECTED);
    expect(mockQuery).toHaveBeenCalledTimes(5);
    for (const [sql, params] of mockQuery.mock.calls) {
      expect(params).toEqual([]);
      expect(sql).not.toMatch(/episode_id/);
    }
  });
});

describe('anything that is not a UUID is rejected with 400 and never reaches a statement', () => {
  test.each([
    ['a number', '42'],
    ['a word', 'abc'],
    ['a quote', `${EPISODE}'`],
    ['a quoted injection', "x' OR '1'='1"],
    ['a semicolon', `${EPISODE}; DROP TABLE thumbnail_compositions; --`],
    ['a bare semicolon', '1;SELECT 1'],
  ])('%s', async (_n, value) => {
    const res = await get(`?episodeId=${encodeURIComponent(value)}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'ERROR', error: 'episodeId must be a UUID' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('a repeated key (array) is rejected', async () => {
    const res = await get(`?episodeId=${EPISODE}&episodeId=${EPISODE}`);
    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

test('unauthenticated caller is still refused by requireAuth', async () => {
  const res = await request(app).get(`${URL}?episodeId=${EPISODE}`);
  expect(res.status).toBe(401);
  expect(mockQuery).not.toHaveBeenCalled();
});

describe('searchCompositions binds the format filter', () => {
  test('a format containing quotes is a bound JSON array, not SQL text', async () => {
    mockQuery.mockReset()
      .mockResolvedValueOnce({ rows: [{ total_count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });
    const evil = `yt"]'::jsonb OR 1=1; --`;
    await FilterService.searchCompositions({ formats: ['youtube', evil], status: 'draft' });
    const [countSql, countParams] = mockQuery.mock.calls[0];
    expect(countSql).toMatch(/tc\.selected_formats @> \$1::jsonb OR tc\.selected_formats @> \$2::jsonb/);
    expect(countSql).toMatch(/tc\.status = \$3/);
    expect(countSql).not.toContain('youtube');
    expect(countSql).not.toContain(evil);
    expect(countParams).toEqual([JSON.stringify(['youtube']), JSON.stringify([evil]), 'draft']);
    const [dataSql, dataParams] = mockQuery.mock.calls[1];
    expect(dataSql).toMatch(/LIMIT \$4 OFFSET \$5/);
    expect(dataParams).toEqual([...countParams, 20, 0]);
  });
});
