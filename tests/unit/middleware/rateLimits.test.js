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
const {
  refusedBy, markSignedIn, waitText, recordRefusal, recentRefusals, clearRefusals, maskIp,
} = require('../../../src/middleware/rateLimits');

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
    clearRefusals();
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
    // Exact to the second, for the login page's countdown: the window is
    // 15 minutes, so a little under 900 seconds are left.
    expect(third.body.retry_after_seconds).toBeGreaterThan(890);
    expect(third.body.retry_after_seconds).toBeLessThanOrEqual(900);
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

describe('retry_after_seconds', () => {
  beforeEach(() => { clearRefusals(); jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => jest.restoreAllMocks());

  const answer = (rateLimit) => {
    const handler = refusedBy('sign-in', 'AUTH_TOO_MANY_FAILED_SIGNINS', () => 'wait');
    const res = { status: jest.fn(() => res), json: jest.fn() };
    handler({ method: 'POST', originalUrl: '/api/v1/auth/login', ip: '10.0.0.7', rateLimit }, res, null, { statusCode: 429 });
    return res.json.mock.calls[0][0];
  };

  test('rounds up to the next second and keeps the minutes field', () => {
    const body = answer({ resetTime: new Date(Date.now() + 272_400) }); // 4:32.4
    expect(body.retry_after_seconds).toBe(273);
    expect(body.retry_after_minutes).toBe(5);
  });

  test('a window that has just ended answers 1 second, not 0', () => {
    expect(answer({ resetTime: new Date(Date.now() - 50) }).retry_after_seconds).toBe(1);
  });

  test('no reset time: both fields are null', () => {
    const body = answer({});
    expect(body.retry_after_seconds).toBeNull();
    expect(body.retry_after_minutes).toBeNull();
  });
});

describe('recent refusals list', () => {
  beforeEach(() => { clearRefusals(); jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => jest.restoreAllMocks());

  test('a refusal is recorded with the limit, code, method, path without the query, and a masked ip', async () => {
    const app = buildApp(1);
    await request(app).get('/api/thing?email=someone@example.com');
    await request(app).get('/api/thing?email=someone@example.com');
    const { refusals, counts } = recentRefusals();
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toMatchObject({ limit: 'site', code: 'API_TOO_MANY_REQUESTS', method: 'GET', path: '/api/thing' });
    expect(refusals[0].ip).toMatch(/x$/);
    expect(JSON.stringify(refusals[0])).not.toContain('someone@example.com');
    expect(Number.isNaN(Date.parse(refusals[0].at))).toBe(false);
    expect(counts).toEqual({ site: 1 });
  });

  test('newest first, with a count per limit', () => {
    recordRefusal({ limit: 'sign-in', code: 'A', method: 'POST', url: '/a', ip: '1.2.3.4', at: new Date('2026-10-23T10:00:00Z') });
    recordRefusal({ limit: 'site', code: 'B', method: 'GET', url: '/b', ip: '1.2.3.4', at: new Date('2026-10-23T10:01:00Z') });
    recordRefusal({ limit: 'sign-in', code: 'A', method: 'POST', url: '/c', ip: '1.2.3.4', at: new Date('2026-10-23T10:02:00Z') });
    const { refusals, counts } = recentRefusals();
    expect(refusals.map((r) => r.path)).toEqual(['/c', '/b', '/a']);
    expect(counts).toEqual({ 'sign-in': 2, site: 1 });
  });

  test('keeps only the last 200', () => {
    for (let i = 0; i < 250; i += 1) {
      recordRefusal({ limit: i < 50 ? 'writes' : 'site', code: 'X', method: 'GET', url: `/r/${i}`, ip: '1.2.3.4' });
    }
    const { refusals, counts, kept } = recentRefusals();
    expect(kept).toBe(200);
    expect(refusals).toHaveLength(200);
    expect(refusals[0].path).toBe('/r/249');
    expect(refusals[199].path).toBe('/r/50');
    expect(counts).toEqual({ site: 200 });
  });

  test('maskIp hides the last part of the address', () => {
    expect(maskIp('203.0.113.42')).toBe('203.0.113.x');
    expect(maskIp('::ffff:203.0.113.42')).toBe('::ffff:203.0.113.x');
    expect(maskIp('2001:db8::8a2e:370:7334')).toBe('2001:db8::8a2e:370:x');
    expect(maskIp(undefined)).toBe('unknown');
  });
});
