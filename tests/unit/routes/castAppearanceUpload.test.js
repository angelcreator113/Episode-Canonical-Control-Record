// ============================================================================
// Upload a photo on a character's Appearance tab (Evoni, 2026-10-22: "I would
// like to be able to upload an appearance photo"). POST
// /characters/:id/appearance/portrait/upload takes one image (field "image"),
// stores it and adds it to their portraits; a refused file is a 400 that says
// why. Mocked models and storage; no database.
// ============================================================================

const express = require('express');
const request = require('supertest');

const ID = '11111111-2222-4333-8444-555555555555';
const mockCharacter = {
  id: ID, display_name: 'Lala', appearance: null, portrait_url: null,
  update: jest.fn(async function update(patch) { Object.assign(this, patch); }),
};
jest.mock('../../../src/models', () => ({ RegistryCharacter: { findByPk: jest.fn(async (id) => (id === ID ? mockCharacter : null)) } }));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => ({
  optionalAuth: (req, _res, next) => next(),
  requireAuth: (req, _res, next) => { req.user = { id: 'u1', groups: ['admin'] }; next(); },
  authorize: () => (req, _res, next) => next(),
  userInGroup: () => true,
}));
jest.mock('../../../src/services/pulseImageService', () => {
  class PulseImageError extends Error {
    constructor(message, status = 400, code = 'INVALID') { super(message); this.status = status; this.code = code; }
  }
  return {
    PulseImageError,
    storePulseImage: jest.fn(async (file) => {
      if (file?.mimetype !== 'image/jpeg') throw new PulseImageError('The photo must be a PNG, JPEG or WebP image.', 400, 'WRONG_TYPE');
      return { url: 'https://store/up.jpg' };
    }),
  };
});

const router = require('../../../src/routes/castRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/cast', router);

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => console.error.mockRestore());

test('an uploaded photo joins their portraits and, with none set, is their profile photo', async () => {
  const res = await request(app)
    .post(`/api/v1/cast/characters/${ID}/appearance/portrait/upload`)
    .attach('image', Buffer.from('jpeg-bytes'), { filename: 'lala.jpg', contentType: 'image/jpeg' });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ success: true, url: 'https://store/up.jpg', portrait_url: 'https://store/up.jpg' });
  expect(res.body.appearance.portraits).toEqual([expect.objectContaining({ url: 'https://store/up.jpg', uploaded: true })]);
});

test('a refused file, no file, or an unknown character says why', async () => {
  const gif = await request(app)
    .post(`/api/v1/cast/characters/${ID}/appearance/portrait/upload`)
    .attach('image', Buffer.from('gif'), { filename: 'a.gif', contentType: 'image/gif' });
  expect(gif.status).toBe(400);
  expect(gif.body).toMatchObject({ success: false, code: 'WRONG_TYPE' });

  const none = await request(app).post(`/api/v1/cast/characters/${ID}/appearance/portrait/upload`);
  expect(none.status).toBe(400);

  const missing = await request(app)
    .post('/api/v1/cast/characters/99999999-2222-4333-8444-555555555555/appearance/portrait/upload')
    .attach('image', Buffer.from('jpeg-bytes'), { filename: 'a.jpg', contentType: 'image/jpeg' });
  expect(missing.status).toBe(404);
});
