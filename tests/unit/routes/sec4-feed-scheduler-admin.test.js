/**
 * SEC-4 (Evoni's admin-only ruling, 2026-10-29): the feed scheduler's
 * controls start paid AI work (a full cycle is estimated at $30-50), so
 * start, stop, run-now and fill-one are admin only, and /start says plainly
 * when FEED_SCHEDULER_ENABLED keeps it off. The real router and auth
 * middleware; the scheduler service is a stand-in, so nothing is generated.
 *
 * 2026-11-22 (Evoni): auto-generate, auto-generate-job and PUT /config are
 * admin only too, refused before the rate limiter and the handler.
 */
jest.mock('../../../src/services/feedScheduler', () => ({
  startScheduler: jest.fn(),
  stopScheduler: jest.fn(),
  getSchedulerStatus: jest.fn(() => ({ running: false })),
  getHistory: jest.fn(() => []),
  getConfig: jest.fn(() => ({})),
  updateConfig: jest.fn(() => ({})),
  configRefusal: jest.fn(() => null),
  runManualCycle: jest.fn(async () => ({ created: 0 })),
  generateCreatorSpark: jest.fn(() => ({ handle: 'spark' })),
  generateSmartSparks: jest.fn(async () => []),
  generateAndSaveProfile: jest.fn(async () => ({ id: 1 })),
  autoGenerateBatch: jest.fn(async () => ({ created: [], errors: [], skipped: [], sparks_generated: 0 })),
  validateClaudeAccess: jest.fn(async () => true),
  setDb: jest.fn(),
  addSSEClient: jest.fn(),
}));
jest.mock('../../../src/models', () => ({}));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const scheduler = require('../../../src/services/feedScheduler');

const app = express();
app.use(express.json());
app.use('/api/v1/feed-scheduler', require('../../../src/routes/feedSchedulerRoutes'));

const token = (groups) => TokenService.generateTokenPair({ id: `sec4-${groups.join('-') || 'none'}`, email: 'sec4@test.dev', name: 'sec4', groups, role: groups[0] }).accessToken;
const post = (p, auth, body = {}) => {
  const r = request(app).post(`/api/v1/feed-scheduler${p}`);
  return (auth ? r.set('Authorization', `Bearer ${auth}`) : r).send(body);
};
const put = (p, auth, body = {}) => {
  const r = request(app).put(`/api/v1/feed-scheduler${p}`);
  return (auth ? r.set('Authorization', `Bearer ${auth}`) : r).send(body);
};
const PAID = { '/start': 'startScheduler', '/run-now': 'runManualCycle', '/fill-one': 'generateAndSaveProfile', '/auto-generate': 'autoGenerateBatch' };

describe('SEC-4: feed scheduler controls are admin only', () => {
  const prev = process.env.FEED_SCHEDULER_ENABLED;
  beforeEach(() => { jest.clearAllMocks(); process.env.FEED_SCHEDULER_ENABLED = 'true'; });
  afterAll(() => { if (prev === undefined) delete process.env.FEED_SCHEDULER_ENABLED; else process.env.FEED_SCHEDULER_ENABLED = prev; });

  test.each(['/start', '/stop', '/run-now', '/fill-one'])('POST %s: 401 without sign-in, 403 for a non-admin, nothing run', async (p) => {
    expect((await post(p, null)).status).toBe(401);
    expect((await post(p, token(['USER']))).status).toBe(403);
    expect(scheduler.startScheduler).not.toHaveBeenCalled();
    expect(scheduler.stopScheduler).not.toHaveBeenCalled();
    expect(scheduler.runManualCycle).not.toHaveBeenCalled();
    expect(scheduler.generateAndSaveProfile).not.toHaveBeenCalled();
  });

  test.each(Object.entries(PAID))('an admin can POST %s', async (p, fn) => {
    const res = await post(p, token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(scheduler[fn]).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['POST', '/auto-generate', post], ['POST', '/auto-generate-job', post], ['PUT', '/config', put],
  ])('%s %s: 401 without sign-in, 403 for a non-admin, before the rate limiter and the handler', async (_verb, p, send) => {
    expect((await send(p, null, { interval_hours: 4 })).status).toBe(401);
    for (const groups of [['USER'], ['USER', 'EDITOR'], ['viewer'], []]) {
      const res = await send(p, token(groups), { interval_hours: 4 });
      expect([groups, res.status, res.body.code]).toEqual([groups, 403, 'AUTH_GROUP_REQUIRED']);
      // aiRateLimiter writes RateLimit-* headers on every request it sees.
      expect(res.headers['ratelimit-limit']).toBeUndefined();
    }
    for (const fn of Object.values(scheduler)) expect(fn).not.toHaveBeenCalled();
  });

  test('an admin can PUT /config; the handler asks the service whether the values are allowed, then applies them', async () => {
    const res = await put('/config', token(['ADMIN']), { batch_size: 10 });
    expect(res.status).toBe(200);
    expect(scheduler.configRefusal).toHaveBeenCalledWith({ batch_size: 10 });
    expect(scheduler.updateConfig).toHaveBeenCalledWith({ batch_size: 10 });
  });

  test('PUT /config with a value the service refuses: 400, and updateConfig is not called', async () => {
    scheduler.configRefusal.mockReturnValueOnce({ code: 'INVALID_SCHEDULER_CONFIG', message: 'batch_size must be a whole number from 1 to 20. Nothing was changed.', fields: ['batch_size'] });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await put('/config', token(['ADMIN']), { batch_size: 500 });
    console.warn.mockRestore();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false, code: 'INVALID_SCHEDULER_CONFIG', fields: ['batch_size'],
      error: 'batch_size must be a whole number from 1 to 20. Nothing was changed.',
      message: 'batch_size must be a whole number from 1 to 20. Nothing was changed.',
    });
    expect(scheduler.updateConfig).not.toHaveBeenCalled();
  });

  test('/start with the scheduler switched off: 409 and a plain message, not "started"', async () => {
    process.env.FEED_SCHEDULER_ENABLED = 'false';
    const res = await post('/start', token(['ADMIN']));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/switched off/);
    expect(scheduler.startScheduler).not.toHaveBeenCalled();
  });
});
