/**
 * The rate limiters say which limit refused, and the site-wide limit counts
 * only signed-out requests (Evoni, 2026-10-23: locked out of sign-in twice in
 * a day, with no way to tell which limit it was).
 */

const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');

jest.mock('../../../src/middleware/auth', () => ({
  verifyToken: jest.fn(),
}));

const { verifyToken } = require('../../../src/middleware/auth');
const { refusedBy, markSignedIn, waitText } = require('../../../src/middleware/rateLimits');

// The same shape as app.js's site-wide limiter, with a small max.
const buildApp = (max = 2) => {
  const app = express();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !!req.rateLimitUser,
    handler: refusedBy('site', 'API_TOO_MANY_REQUESTS', (mins) => `Try again in ${waitText(mins)}.`),
  });
  app.use('/api', markSignedIn, limiter);
  app.get('/api/thing', (req, res) => res.json({ ok: true }));
  return app;
};

describe('rate limits', () => {
  let warn;
  beforeEach(() => {
    jest.clearAllMocks();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  test('signed-out requests stop at the limit, with the limit named and a log line', async () => {
    const app = buildApp(2);
    expect((await request(app).get('/api/thing')).status).toBe(200);
    expect((await request(app).get('/api/thing')).status).toBe(200);
    const third = await request(app).get('/api/thing');
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ code: 'API_TOO_MANY_REQUESTS', limit: 'site', retry_after_minutes: 15 });
    expect(third.body.message).toBe('Try again in about 15 minutes.');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[rate-limit\] site limit refused GET \/api\/thing ip=.* resets in 15 min$/));
  });

  test('requests with a valid sign-in token are not counted', async () => {
    verifyToken.mockResolvedValue({ payload: { sub: 'user-1' } });
    const app = buildApp(2);
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app).get('/api/thing').set('Authorization', 'Bearer good-token');
      expect(res.status).toBe(200);
    }
    expect(verifyToken).toHaveBeenCalledWith('good-token');
  });

  test('a bad or expired token is counted like a signed-out request', async () => {
    verifyToken.mockRejectedValue(new Error('jwt expired'));
    const app = buildApp(1);
    expect((await request(app).get('/api/thing').set('Authorization', 'Bearer stale')).status).toBe(200);
    expect((await request(app).get('/api/thing').set('Authorization', 'Bearer stale')).status).toBe(429);
  });

  test('markSignedIn never sets req.user (FD-67: no global identity)', async () => {
    verifyToken.mockResolvedValue({ payload: { sub: 'user-1' } });
    const app = express();
    app.use(markSignedIn);
    app.get('/x', (req, res) => res.json({ user: req.user === undefined ? 'unset' : req.user, mark: req.rateLimitUser }));
    const res = await request(app).get('/x').set('Authorization', 'Bearer good-token');
    expect(res.body).toEqual({ user: 'unset', mark: 'user-1' });
  });

  test('waitText words the wait', () => {
    expect(waitText(1)).toBe('about 1 minute');
    expect(waitText(7)).toBe('about 7 minutes');
    expect(waitText(null)).toBe('a few minutes');
  });
});
