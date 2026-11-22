/**
 * The production package reads are an ADMIN's (Evoni, 2026-11-22). GET
 * /api/v1/episodes/:episodeId/production-package/latest, /versions,
 * /:packageId and /:packageId/download answered any signed-in account with a
 * package built from the episode's script. They now need a sign-in in the
 * admin group. Generating and deleting a package became an ADMIN's later the
 * same day (productionPackage-writes-admin-only.test.js has their full cases).
 *
 * The real router, auth middleware and controller; the pool and the package
 * service are stand-ins, so no database is read and nothing is built.
 */
const mockQuery = jest.fn();
const mockGenerate = jest.fn();
jest.mock('../../../src/db', () => ({ pool: { query: (...a) => mockQuery(...a) } }));
jest.mock('../../../src/services/productionPackageService', () => ({ generatePackage: (...a) => mockGenerate(...a) }));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');

const app = express();
app.use(express.json());
app.use('/api/v1/episodes', require('../../../src/routes/productionPackage'));

const EP = '11111111-1111-4111-8111-111111111111';
const PKG = '22222222-2222-4222-8222-222222222222';
const BASE = `/api/v1/episodes/${EP}/production-package`;
const token = (groups) => TokenService.generateTokenPair({
  id: `package-${groups.join('-') || 'none'}`, email: 'package@test.dev', name: 'package', groups, role: groups[0],
}).accessToken;
const call = (method, path, auth) => {
  const r = request(app)[method](`${BASE}${path}`);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

const ROW = { id: PKG, episode_id: EP, package_version: 2, is_latest: true, zip_file_s3_url: 'https://bucket/package.zip', zip_file_size_bytes: 10, script_markdown: 'Lala: The unpublished line.' };
const READS = ['/latest', '/versions', `/${PKG}`, `/${PKG}/download`];

beforeEach(() => {
  mockQuery.mockReset();
  mockGenerate.mockReset();
  mockQuery.mockResolvedValue({ rows: [ROW], rowCount: 1 });
});

describe('the production package reads need a sign-in in the admin group', () => {
  test.each(READS)('signed out: GET %s is a 401 and reads nothing', async (path) => {
    expect((await call('get', path, null)).status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test.each(READS)('signed in but not an admin: GET %s is a 403 and reads nothing', async (path) => {
    for (const groups of [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []]) {
      const res = await call('get', path, token(groups));
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
      expect(res.headers.location).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('unpublished line');
    }
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('an admin: the latest, the versions and one package, as they were', async () => {
    const admin = token(['ADMIN']);
    const latest = await call('get', '/latest', admin);
    expect(latest.status).toBe(200);
    expect(latest.body).toEqual({ success: true, data: ROW });
    const versions = await call('get', '/versions', admin);
    expect(versions.status).toBe(200);
    expect(versions.body.meta).toEqual({ count: 1, episode_id: EP });
    const one = await call('get', `/${PKG}`, admin);
    expect(one.status).toBe(200);
    expect(mockQuery.mock.calls[2][1]).toEqual([PKG, EP]);
  });

  test('an admin: the download redirects to the package\'s file', async () => {
    const res = await call('get', `/${PKG}/download`, token(['ADMIN']));
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(ROW.zip_file_s3_url);
  });

  test('an admin, no package: a 404', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    expect((await call('get', '/latest', token(['ADMIN']))).status).toBe(404);
  });
});

describe('the two writes are an ADMIN\'s too', () => {
  test('signed out, they are a 401', async () => {
    expect((await call('post', '/generate', null)).status).toBe(401);
    expect((await call('delete', `/${PKG}`, null)).status).toBe(401);
  });
  test('signed in and not an admin, generating is refused for the group and builds nothing', async () => {
    mockGenerate.mockResolvedValue({ package: { package_version: 3, zip_file_s3_url: 'https://bucket/p3.zip' }, fileCount: 4 });
    const res = await call('post', '/generate', token(['USER']));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  test('an admin generates as before', async () => {
    mockGenerate.mockResolvedValue({ package: { package_version: 3, zip_file_s3_url: 'https://bucket/p3.zip' }, fileCount: 4 });
    const res = await call('post', '/generate', token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledWith(EP, expect.anything());
  });
});
