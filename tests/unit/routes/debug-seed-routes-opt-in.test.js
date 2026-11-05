// ============================================================================
// Debug and seed routes are off unless explicitly enabled, and admin-only
// ============================================================================
// Evoni: "Disable by default and require explicit authorization for any
// diagnostic access." /api/v1/debug/* mounts only with ENABLE_DEBUG_ROUTES=true,
// /api/v1/seed only with ENABLE_SEED_ROUTES=true, neither ever under
// NODE_ENV=production, and a mounted route needs requireAuth + ADMIN.

process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-minimum-32-characters-long';

jest.mock('@aws-sdk/credential-providers', () => ({
  fromIni: jest.fn(() => jest.fn().mockResolvedValue({ accessKeyId: 'x', secretAccessKey: 'x' })),
  fromEnv: jest.fn(() => jest.fn().mockResolvedValue({ accessKeyId: 'x', secretAccessKey: 'x' })),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(), GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(), DeleteObjectCommand: jest.fn(),
}));
jest.mock('aws-sdk', () => ({
  CognitoIdentityServiceProvider: jest.fn(() => ({
    getSigningCertificate: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Certificate: 'test' }),
    }),
  })),
  S3: jest.fn(() => ({ getSignedUrl: jest.fn((op, params, cb) => cb(null, 'https://mock')) })),
  SQS: jest.fn(() => ({ sendMessage: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) }) })),
}));

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const { diagnosticRoutesEnabled } = require('../../../src/utils/diagnosticRoutes');

const DEBUG_PATHS = ['/api/v1/debug/routes', '/api/v1/debug/env', '/api/v1/debug/data-check'];

const adminToken = () => TokenService.generateTokenPair({
  id: 'debug-admin', email: 'admin@debug.test', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN',
}).accessToken;
const editorToken = () => TokenService.generateTokenPair({
  id: 'debug-editor', email: 'editor@debug.test', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
}).accessToken;

// Load a fresh app with the given flags; restores process.env afterwards.
function loadApp(flags) {
  const saved = { ENABLE_DEBUG_ROUTES: process.env.ENABLE_DEBUG_ROUTES, ENABLE_SEED_ROUTES: process.env.ENABLE_SEED_ROUTES };
  delete process.env.ENABLE_DEBUG_ROUTES;
  delete process.env.ENABLE_SEED_ROUTES;
  Object.assign(process.env, flags);
  let app;
  try {
    jest.isolateModules(() => { app = require('../../../src/app'); });
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
  return app;
}

describe('diagnosticRoutesEnabled (the gate)', () => {
  test.each([
    ['flag unset, NODE_ENV unset', {}, false],
    ['flag unset, development', { NODE_ENV: 'development' }, false],
    ['flag unset, test', { NODE_ENV: 'test' }, false],
    ['flag "1" is not "true"', { ENABLE_DEBUG_ROUTES: '1' }, false],
    ['flag "TRUE" is not "true"', { ENABLE_DEBUG_ROUTES: 'TRUE' }, false],
    ['flag true, NODE_ENV unset', { ENABLE_DEBUG_ROUTES: 'true' }, true],
    ['flag true, development', { ENABLE_DEBUG_ROUTES: 'true', NODE_ENV: 'development' }, true],
    ['flag true, production', { ENABLE_DEBUG_ROUTES: 'true', NODE_ENV: 'production' }, false],
  ])('%s', (_label, env, expected) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(diagnosticRoutesEnabled('ENABLE_DEBUG_ROUTES', env)).toBe(expected);
    warn.mockRestore();
  });

  test('seed flag is independent of the debug flag', () => {
    expect(diagnosticRoutesEnabled('ENABLE_SEED_ROUTES', { ENABLE_DEBUG_ROUTES: 'true' })).toBe(false);
    expect(diagnosticRoutesEnabled('ENABLE_SEED_ROUTES', { ENABLE_SEED_ROUTES: 'true' })).toBe(true);
    expect(diagnosticRoutesEnabled('ENABLE_DEBUG_ROUTES', { ENABLE_SEED_ROUTES: 'true' })).toBe(false);
  });

  test('an unknown flag name throws', () => {
    expect(() => diagnosticRoutesEnabled('ENABLE_EVERYTHING', {})).toThrow(/Unknown diagnostic route flag/);
  });
});

describe('app.js mounts debug and seed routes only through the gate', () => {
  const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'app.js'), 'utf8');

  test('no debug or seed mount is gated on NODE_ENV alone', () => {
    expect(SRC).not.toMatch(/if\s*\(\s*process\.env\.NODE_ENV\s*!==\s*['"]production['"]\s*\)\s*\{\s*app\.(get|use)\(['"]\/api\/v1\/(debug|seed)/);
  });

  test.each(DEBUG_PATHS)('%s carries requireAuth + ADMIN', (p) => {
    const re = new RegExp(`app\\.get\\(['"]${p.replace(/\//g, '\\/')}['"],\\s*requireAuth,\\s*authorize\\(\\['ADMIN'\\]\\)`);
    expect(SRC).toMatch(re);
  });

  test('/api/v1/seed carries requireAuth + ADMIN at the mount line', () => {
    expect(SRC).toMatch(/if\s*\(\s*SEED_ROUTES_ENABLED\s*\)\s*\{[\s\S]{0,300}app\.use\(['"]\/api\/v1\/seed['"],\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*seedRoutes\)/);
  });
});

describe('flags unset: debug and seed routes are not mounted', () => {
  let app;
  beforeAll(() => { app = loadApp({}); });

  test.each(DEBUG_PATHS)('GET %s is 404, even for an admin', async (p) => {
    expect((await request(app).get(p)).status).toBe(404);
    expect((await request(app).get(p).set('Authorization', `Bearer ${adminToken()}`)).status).toBe(404);
  });

  test('POST /api/v1/seed/all is 404, even for an admin', async () => {
    expect((await request(app).post('/api/v1/seed/all')).status).toBe(404);
    expect((await request(app).post('/api/v1/seed/all').set('Authorization', `Bearer ${adminToken()}`)).status).toBe(404);
  });

  test('public /health still answers', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
  });
});

describe('ENABLE_DEBUG_ROUTES=true: mounted, admin-only', () => {
  let app;
  beforeAll(() => { app = loadApp({ ENABLE_DEBUG_ROUTES: 'true' }); });

  test.each(DEBUG_PATHS)('GET %s without a token is 401', async (p) => {
    expect((await request(app).get(p)).status).toBe(401);
  });

  test.each(DEBUG_PATHS)('GET %s as a non-admin is 403', async (p) => {
    expect((await request(app).get(p).set('Authorization', `Bearer ${editorToken()}`)).status).toBe(403);
  });

  test('GET /api/v1/debug/routes as an admin is 200 with the route load summary', async () => {
    const res = await request(app).get('/api/v1/debug/routes').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ total: expect.any(Number), loaded: expect.any(Number), failed: expect.any(Number) }));
  });

  test('GET /api/v1/debug/env as an admin is 200', async () => {
    const res = await request(app).get('/api/v1/debug/env').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
  });

  test('the seed flag is still off: /api/v1/seed is 404', async () => {
    expect((await request(app).post('/api/v1/seed/all')).status).toBe(404);
  });
});

describe('ENABLE_SEED_ROUTES=true: mounted, admin-only', () => {
  let app;
  beforeAll(() => { app = loadApp({ ENABLE_SEED_ROUTES: 'true' }); });

  test('POST /api/v1/seed/all without a token is 401', async () => {
    expect((await request(app).post('/api/v1/seed/all')).status).toBe(401);
  });

  test('POST /api/v1/seed/all as a non-admin is 403', async () => {
    expect((await request(app).post('/api/v1/seed/all').set('Authorization', `Bearer ${editorToken()}`)).status).toBe(403);
  });

  test('the debug flag is still off: /api/v1/debug/routes is 404', async () => {
    expect((await request(app).get('/api/v1/debug/routes').set('Authorization', `Bearer ${adminToken()}`)).status).toBe(404);
  });
});
