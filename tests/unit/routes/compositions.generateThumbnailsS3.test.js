// ============================================================================
// generate-thumbnails creates its S3 client instead of refusing (#1921)
// ============================================================================
// The S3 client in routes/compositions.js is lazy: getS3Client() builds it on
// first use. The route used to check the module-level s3Client before anything
// had called getS3Client(), so on a fresh process every call answered
// 500 "AWS SDK not properly initialized". Outside a named AWS_PROFILE the client
// also insisted on env keys (fromEnv), which the EC2 instance role does not set.
// Mocked models and S3 SDK, no database, no network.

const express = require('express');
const request = require('supertest');

const mockFindByPk = jest.fn();
const mockS3Ctor = jest.fn();

jest.mock('../../../src/db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../../src/models', () => ({
  models: { ThumbnailComposition: { findByPk: (...a) => mockFindByPk(...a) } },
}));
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
    requireAuth: (req, _res, next) => {
      req.user = { id: 'u1' };
      next();
    },
  };
});
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: function S3Client(config) {
      mockS3Ctor(config);
      this.send = async () => ({});
    },
  };
});

const ID = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
const URL = `/api/v1/compositions/${ID}/generate-thumbnails`;

const loadApp = () => {
  let router;
  jest.isolateModules(() => {
    router = require('../../../src/routes/compositions');
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/compositions', router);
  return app;
};

const saved = {};
beforeEach(() => {
  mockFindByPk.mockReset().mockResolvedValue(null);
  mockS3Ctor.mockReset();
  for (const k of ['NODE_ENV', 'AWS_PROFILE', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) saved[k] = process.env[k];
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  jest.restoreAllMocks();
});

test('a fresh process reaches the composition lookup instead of answering 500', async () => {
  const res = await request(loadApp()).post(URL).send({});
  expect(res.body.error).not.toBe('AWS SDK not properly initialized');
  expect(res.status).toBe(404);
  expect(mockFindByPk).toHaveBeenCalledWith(ID, expect.any(Object));
});

test('without AWS_PROFILE or env keys the client uses the default chain (instance role)', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.AWS_PROFILE;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;

  const res = await request(loadApp()).post(URL).send({});
  expect(res.status).toBe(404);
  expect(mockS3Ctor).toHaveBeenCalledTimes(1);
  expect(mockS3Ctor.mock.calls[0][0].credentials).toBeUndefined();
});
