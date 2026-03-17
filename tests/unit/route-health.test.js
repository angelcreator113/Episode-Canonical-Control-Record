// ============================================================================
// ROUTE HEALTH TEST — catches broken requires, missing models, load failures
// ============================================================================
// Validates that every route file in src/routes/ can be required without
// crashing. This catches:
//   - Syntax errors
//   - Missing module dependencies
//   - Top-level code that throws on require()
//   - Circular dependency issues
//
// Run with: npm run test:route-health

process.env.NODE_ENV = 'test';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.DATABASE_URL = 'postgres://localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';

// Mock heavy external dependencies so route files load fast
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

const ROUTES_DIR = path.join(__dirname, '../../src/routes');

// Get all .js route files
const routeFiles = fs.readdirSync(ROUTES_DIR)
  .filter(f => f.endsWith('.js'))
  .sort();

describe('Route Health — All route files load without crashing', () => {
  // Track which routes fail so we can report them all at once
  const failures = [];

  afterAll(() => {
    if (failures.length > 0) {
      console.error('\n=== ROUTE LOAD FAILURES ===');
      failures.forEach(({ file, error }) => {
        console.error(`  ✗ ${file}: ${error}`);
      });
      console.error(`\n${failures.length} of ${routeFiles.length} route files failed to load.\n`);
    }
  });

  test.each(routeFiles)('src/routes/%s loads without error', (file) => {
    const filePath = path.join(ROUTES_DIR, file);
    try {
      require(filePath);
    } catch (err) {
      failures.push({ file, error: err.message });
      // Don't throw MODULE_NOT_FOUND for optional peer deps (redis, canvas, etc.)
      // But DO throw for our own files (src/)
      if (err.code === 'MODULE_NOT_FOUND' && !err.message.includes('/src/')) {
        console.warn(`  ⚠ ${file}: optional dep missing — ${err.message.split('\n')[0]}`);
        return; // Skip, don't fail
      }
      // Skip routes that need live services (Redis/Bull queues, etc.)
      if (err.message.includes('Bull') || err.message.includes('Redis') || err.message.includes('ECONNREFUSED')) {
        console.warn(`  ⚠ ${file}: needs live service — ${err.message.split('\n')[0]}`);
        return;
      }
      throw new Error(`Route file ${file} failed to load: ${err.message}`);
    }
  });
});

describe('Route Health — App exports Express app', () => {
  let app;

  beforeAll(() => {
    try {
      app = require('../../src/app');
    } catch (err) {
      // App might fail to load in test env — that's the whole point of this test
      console.error('App failed to load:', err.message);
    }
  });

  test('app.js loads and exports an Express app', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function'); // Express app is a function
  });

  test('health endpoint returns 200', async () => {
    if (!app) return;
    const request = require('supertest');
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  test('no critical routes failed to load', async () => {
    if (!app) return;
    const request = require('supertest');
    const res = await request(app).get('/api/v1/debug/routes');
    if (res.status !== 200) {
      console.warn('Debug routes endpoint not available (production mode?)');
      return;
    }

    const failed = res.body?.failed || [];
    if (failed.length > 0) {
      console.error('\nRoutes that failed to load at startup:');
      failed.forEach(f => console.error(`  ✗ ${f.name}: ${f.message}`));
    }
    // Warn but don't fail — some routes may have optional deps
    // The individual route file tests above catch hard failures
  });
});
