/**
 * SEC-6 (Evoni's admin-only ruling, 2026-10-29):
 *   - GET /api/v1/episodes/test-create (made an Episode row on a GET) and the
 *     scenes diagnostics /ultra-test, /db-test, /test-direct/:id (database
 *     and schema details) are removed; nothing in the app called them.
 *   - Export is admin only in every environment; it was optionalAuth
 *     whenever NODE_ENV was not 'production'.
 *   - The /api/v1/debug routes mount only when NODE_ENV is development or test.
 */
jest.mock('../../../src/queues/videoQueue', () => ({ addExportJob: jest.fn(async () => ({ id: 'job-1' })), getExportJob: jest.fn(async () => null) }));
jest.mock('../../../src/models', () => ({ sequelize: { query: jest.fn(async () => [[]]) } }));
jest.mock('../../../src/config/database', () => ({}));
jest.mock('../../../src/services/S3Service', () => ({}));
jest.mock('../../../src/services/beatScenesService', () => ({ syncBeatScenesQuietly: jest.fn(async () => {}) }));

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');

const ROOT = path.join(__dirname, '..', '..', '..', 'src');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const token = (groups) => TokenService.generateTokenPair({ id: `sec6-${groups.join('-') || 'none'}`, email: 'sec6@test.dev', name: 'sec6', groups, role: groups[0] }).accessToken;

describe('SEC-6: test and diagnostic routes are gone', () => {
  test('no test-create, ultra-test, db-test or test-direct route is declared', () => {
    expect(read('routes/episodes.js')).not.toMatch(/['"]\/test-create['"]/);
    const scenes = read('routes/scenes.js');
    expect(scenes).not.toMatch(/['"]\/ultra-test['"]/);
    expect(scenes).not.toMatch(/['"]\/db-test['"]/);
    expect(scenes).not.toMatch(/['"]\/test-direct\/:id['"]/);
  });

  test('the debug routes mount only for NODE_ENV development or test, never by default', () => {
    expect(read('app.js')).toMatch(/if \(\['development', 'test'\]\.includes\(process\.env\.NODE_ENV\)\) \{\n\s*app\.get\('\/api\/v1\/debug\/env'/);
  });
});

describe.each(['production', 'development', undefined])('SEC-6: export is admin only with NODE_ENV=%s', (env) => {
  let app;
  beforeAll(() => {
    const prev = process.env.NODE_ENV;
    if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env;
    jest.isolateModules(() => {
      app = express();
      app.use(express.json());
      app.use('/api/v1', require('../../../src/routes/export'));
    });
    process.env.NODE_ENV = prev;
  });

  const ROUTES = [
    ['post', '/api/v1/episodes/ep-1/export'],
    ['get', '/api/v1/export/status/job-1'],
    ['get', '/api/v1/exports'],
    ['delete', '/api/v1/export/job-1'],
    ['get', '/api/v1/export/download/job-1'],
    ['get', '/api/v1/export/file/job-1'],
  ];

  test.each(ROUTES)('%s %s: 401 without sign-in, 403 for a non-admin', async (method, url) => {
    expect((await request(app)[method](url).send({})).status).toBe(401);
    expect((await request(app)[method](url).set('Authorization', `Bearer ${token(['USER'])}`).send({})).status).toBe(403);
  });
});
