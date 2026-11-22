/**
 * The script search is an ADMIN's (Evoni, 2026-11-22). GET
 * /api/v1/search/scripts answered any signed-in account with the first 200
 * characters of each matching script's text, drafts included. It now needs a
 * sign-in in the admin group. The other searches are as they were.
 *
 * The real router, auth middleware and controller; the pool is a stand-in,
 * so no database is read.
 */
const mockQuery = jest.fn();
jest.mock('../../../src/config/database', () => ({ getPool: () => ({ query: (...a) => mockQuery(...a) }) }));
jest.mock('../../../src/services/ActivityIndexService', () => ({}));

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const TokenService = require('../../../src/services/tokenService');

const app = express();
app.use(express.json());
app.use('/api/v1/search', require('../../../src/routes/search'));

const token = (groups) => TokenService.generateTokenPair({
  id: `search-${groups.join('-') || 'none'}`, email: 'search@test.dev', name: 'search', groups, role: groups[0],
}).accessToken;
const search = (auth, q = '?q=gala') => {
  const r = request(app).get(`/api/v1/search/scripts${q}`);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

const HIT = {
  id: 'sc-1', episode_id: 'ep-1', script_type: 'main', version_number: 3, version_label: 'Draft 3', author: 'Evoni', status: 'draft',
  duration: 600, scene_count: 14, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z', is_primary: true, is_latest: true,
  search_rank: 0.5, content_preview: 'Lala: The unpublished line.',
};

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql) => {
    if (/COUNT\(\*\)/.test(sql)) return { rows: [{ count: '1' }], rowCount: 1 };
    if (/FROM episode_scripts/.test(sql)) return { rows: [HIT], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
});
const scriptQueries = () => mockQuery.mock.calls.filter(([sql]) => /episode_scripts/.test(sql)).length;

describe('GET /api/v1/search/scripts needs a sign-in in the admin group', () => {
  test('signed out: a 401, and no script is read', async () => {
    const res = await search(null);
    expect(res.status).toBe(401);
    expect(scriptQueries()).toBe(0);
  });

  test('signed in but not an admin: a 403, and no script is read', async () => {
    for (const groups of [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []]) {
      const res = await search(token(groups));
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('unpublished line');
    }
    expect(scriptQueries()).toBe(0);
  });

  test('an admin: the hits, as they were, from live scripts only', async () => {
    const res = await search(token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([HIT]);
    expect(res.body.pagination).toEqual({ total: 1, page: 1, page_size: 20, pages: 1 });
    const selects = mockQuery.mock.calls.map(([sql]) => sql).filter((sql) => /FROM episode_scripts/.test(sql));
    expect(selects).toHaveLength(2);
    for (const sql of selects) {
      expect(sql).toMatch(/deleted_at IS NULL/);
      expect(sql).not.toMatch(/SELECT\s+\*/);
    }
  });

  test('an admin without a query is still a 400', async () => {
    expect((await search(token(['ADMIN']), '')).status).toBe(400);
  });
});

describe('the rest of the file is as it was', () => {
  const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'search.js'), 'utf8');
  test('only the script search names the admin group', () => {
    const admin = (SRC.match(/^router\..*authorize\(\['ADMIN'\]\).*$/gm) || []);
    expect(admin).toEqual(["router.get('/scripts', requireAuth, authorize(['ADMIN']), searchController.searchScripts);"]);
  });
  test('every route still needs a sign-in', () => {
    const routes = SRC.match(/^router\.(get|post|put|patch|delete)\(.*$/gm) || [];
    expect(routes).toHaveLength(10);
    for (const line of routes) expect(line).toMatch(/\brequireAuth\b/);
  });
});
