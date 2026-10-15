/**
 * Scene Sets audit (2026-10-15): an upload multer refuses (not an image,
 * over 10 MB) reached Express's error handler as a 500. The base and angle
 * uploads now answer 400 and 413, with a code the page can show.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('Scene set uploads refused by the upload itself', () => {
  let token;
  const setId = crypto.randomUUID();
  const angleId = crypto.randomUUID();
  const paths = [`/api/v1/scene-sets/${setId}/upload-base`, `/api/v1/scene-sets/${setId}/angles/${angleId}/upload`];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-upload-refusals', email: 'user@upload-refusals.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => jest.restoreAllMocks());

  test('a file that is not an image is a 400', async () => {
    for (const path of paths) {
      const res = await request(app).post(path).set('Authorization', `Bearer ${token}`)
        .attach('image', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
      expect([path, res.status, res.body.code]).toEqual([path, 400, 'BAD_FILE']);
      expect(res.body.error).toMatch(/JPEG, PNG, and WebP/);
    }
  });

  test('an image over 10 MB is a 413', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1024, 0);
    for (const path of paths) {
      const res = await request(app).post(path).set('Authorization', `Bearer ${token}`)
        .attach('image', big, { filename: 'huge.png', contentType: 'image/png' });
      expect([path, res.status, res.body.code]).toEqual([path, 413, 'FILE_TOO_LARGE']);
    }
  });
});
