/**
 * GET /api/v1/admin/rate-limit-refusals — the recent refusals list behind
 * Admin › Tools (Evoni, 2026-10-23: locked out twice, with no way to see
 * which limit it was). Admins only.
 */

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const { recordRefusal, clearRefusals } = require('../../../src/middleware/rateLimits');
const adminRoutes = require('../../../src/routes/admin');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRoutes);
  return app;
};

const tokenFor = (groups) => TokenService.generateToken({ id: 'u1', email: 'u1@example.com', name: 'U', groups });

describe('GET /api/v1/admin/rate-limit-refusals', () => {
  beforeEach(() => clearRefusals());

  test('signed out: 401', async () => {
    const res = await request(buildApp()).get('/api/v1/admin/rate-limit-refusals');
    expect(res.status).toBe(401);
  });

  test('signed in but not an admin: 403', async () => {
    const res = await request(buildApp())
      .get('/api/v1/admin/rate-limit-refusals')
      .set('Authorization', `Bearer ${tokenFor(['USER', 'EDITOR'])}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
  });

  test('an admin gets the list, newest first, with counts per limit', async () => {
    recordRefusal({ limit: 'sign-in', code: 'AUTH_TOO_MANY_FAILED_SIGNINS', method: 'POST', url: '/api/v1/auth/login', ip: '198.51.100.23', at: new Date('2026-10-23T09:00:00Z') });
    recordRefusal({ limit: 'site', code: 'API_TOO_MANY_REQUESTS', method: 'GET', url: '/api/v1/episodes?page=2', ip: '198.51.100.23', at: new Date('2026-10-23T09:05:00Z') });

    const res = await request(buildApp())
      .get('/api/v1/admin/rate-limit-refusals')
      .set('Authorization', `Bearer ${tokenFor(['admin'])}`);

    expect(res.status).toBe(200);
    expect(res.body.data.kept).toBe(200);
    expect(res.body.data.counts).toEqual({ 'sign-in': 1, site: 1 });
    expect(res.body.data.refusals).toEqual([
      { at: '2026-10-23T09:05:00.000Z', limit: 'site', code: 'API_TOO_MANY_REQUESTS', method: 'GET', path: '/api/v1/episodes', ip: '198.51.100.x' },
      { at: '2026-10-23T09:00:00.000Z', limit: 'sign-in', code: 'AUTH_TOO_MANY_FAILED_SIGNINS', method: 'POST', path: '/api/v1/auth/login', ip: '198.51.100.x' },
    ]);
  });
});
