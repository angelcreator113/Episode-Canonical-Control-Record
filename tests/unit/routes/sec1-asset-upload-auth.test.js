/**
 * SEC-1 (Evoni's admin-only ruling, 2026-10-29): POST /api/v1/assets checks
 * the sign-in and the ADMIN group before multer reads the upload. With multer
 * first, up to 500 MB was held in memory for a request that was then refused.
 * The real router and auth middleware; the asset service and models are
 * stand-ins, so no database or S3 is touched.
 */
jest.mock('../../../src/services/AssetService', () => ({ uploadAsset: jest.fn() }));
jest.mock('../../../src/models', () => ({ models: {} }));
jest.mock('../../../src/services/imageCostService', () => ({ isBudgetError: () => false }));

const express = require('express');
const multer = require('multer');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');

// Counts every multipart body multer starts to read for this router.
const reads = { count: 0 };
const realMemoryStorage = multer.memoryStorage;
jest.spyOn(multer, 'memoryStorage').mockImplementation(() => {
  const storage = realMemoryStorage();
  const handle = storage._handleFile.bind(storage);
  storage._handleFile = (req, file, cb) => { reads.count += 1; handle(req, file, cb); };
  return storage;
});

const router = require('../../../src/routes/assets');

const app = express();
app.use('/api/v1/assets', router);

const token = (groups) => TokenService.generateTokenPair({ id: `sec1-${groups.join('-') || 'none'}`, email: 'sec1@test.dev', name: 'sec1', groups, role: groups[0] }).accessToken;
const upload = (auth) => {
  let r = request(app).post('/api/v1/assets').field('assetType', 'PROMO_LALA');
  if (auth) r = r.set('Authorization', `Bearer ${auth}`);
  return r.attach('file', Buffer.alloc(64 * 1024, 1), { filename: 'big.png', contentType: 'image/png' });
};

describe('SEC-1: POST /api/v1/assets refuses before reading the upload', () => {
  beforeEach(() => { reads.count = 0; });

  test('no sign-in: 401, and multer never reads the file', async () => {
    const res = await upload(null);
    expect(res.status).toBe(401);
    expect(reads.count).toBe(0);
  });

  test('signed in but not an admin: 403, and multer never reads the file', async () => {
    const res = await upload(token(['USER']));
    expect(res.status).toBe(403);
    expect(reads.count).toBe(0);
  });

  test('an admin: multer reads the file (the upload goes on to validation)', async () => {
    const res = await upload(token(['ADMIN']));
    expect([401, 403]).not.toContain(res.status);
    expect(reads.count).toBe(1);
  });
});
