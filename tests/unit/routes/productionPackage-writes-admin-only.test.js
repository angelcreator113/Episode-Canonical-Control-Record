/**
 * Generating and deleting a production package are an ADMIN's (Evoni,
 * 2026-11-22). POST /api/v1/episodes/:episodeId/production-package/generate
 * answered any signed-in account with a package built from the episode's
 * script (and uploaded a ZIP); DELETE .../production-package/:packageId
 * hard-deleted a package row for any signed-in account. Both now need a
 * sign-in in the admin group, refused before the handler.
 *
 * The real router, auth middleware and controller; the pool and the package
 * service are stand-ins, so no database is read, nothing is built and
 * nothing is uploaded.
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
const NON_ADMINS = [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []].map((groups) => [groups]);
const userId = (groups) => `pkgw-${groups.join('-') || 'none'}`;
const token = (groups) => TokenService.generateTokenPair({
  id: userId(groups), email: 'pkgw@test.dev', name: 'pkgw', groups, role: groups[0],
}).accessToken;
const call = (method, path, auth) => {
  const r = request(app)[method](`${BASE}${path}`);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

// What a built package carries: script text and a link to the ZIP.
const BUILT = {
  package: {
    id: PKG, episode_id: EP, package_version: 3,
    final_script_md: 'ZZPKG-SCRIPT Lala: The unpublished line.',
    zip_file_s3_url: 'https://bucket.example/ZZPKG-SIGNED/p3.zip?X-Amz-Signature=abc',
  },
  fileCount: 4,
};
const LEAKS = ['final_script_md', 'ZZPKG-SCRIPT', 'unpublished line', 'ZZPKG-SIGNED', 'X-Amz-Signature', 'zip_file_s3_url', 'zip_url'];

beforeEach(() => {
  mockQuery.mockReset();
  mockGenerate.mockReset();
  mockGenerate.mockResolvedValue(BUILT);
  mockQuery.mockResolvedValue({ rows: [{ id: PKG }], rowCount: 1 });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('POST /:episodeId/production-package/generate needs a sign-in in the admin group', () => {
  test('signed out: a 401, and nothing is built', async () => {
    const res = await call('post', '/generate', null);
    expect(res.status).toBe(401);
    for (const leak of LEAKS) expect(res.text).not.toContain(leak);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test.each(NON_ADMINS)('signed in, groups %j: a 403, nothing is built and nothing of a package is sent', async (groups) => {
    const res = await call('post', '/generate', token(groups));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
    expect(res.body.data).toBeUndefined();
    expect(res.body.meta).toBeUndefined();
    for (const leak of LEAKS) expect(res.text).not.toContain(leak);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('an admin: the package is built for the episode and answered as before', async () => {
    const res = await call('post', '/generate', token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(EP, { userId: userId(['ADMIN']) });
    expect(res.body).toEqual({
      success: true,
      data: BUILT.package,
      meta: { package_version: 3, zip_url: BUILT.package.zip_file_s3_url, file_count: 4, generation_time_ms: expect.any(Number) },
    });
  });

  test('an admin, and the build fails: the same 500 as before', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGenerate.mockRejectedValue(new Error('no script'));
    const res = await call('post', '/generate', token(['ADMIN']));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: { message: 'Failed to generate production package', details: 'no script' } });
  });
});

describe('DELETE /:episodeId/production-package/:packageId needs a sign-in in the admin group', () => {
  test('signed out: a 401, and no query runs', async () => {
    expect((await call('delete', `/${PKG}`, null)).status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test.each(NON_ADMINS)('signed in, groups %j: a 403, and no query runs', async (groups) => {
    const res = await call('delete', `/${PKG}`, token(groups));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
    expect(res.body.data).toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test('an admin: the same delete, with the same arguments and answer as before', async () => {
    const res = await call('delete', `/${PKG}`, token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: PKG, deleted: true } });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      'DELETE FROM production_packages WHERE id = $1 AND episode_id = $2 RETURNING id',
      [PKG, EP],
    );
  });

  test('an admin, no such package: the same 404 as before', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await call('delete', `/${PKG}`, token(['ADMIN']));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: { message: 'Production package not found' } });
  });
});
