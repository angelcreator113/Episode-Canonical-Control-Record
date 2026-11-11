/**
 * P0 admin authorization: the APIs behind Admin › Tools that were already
 * ADMIN only (CFO Agent, Site Organizer, Design Agent, AI Costs, Audit Logs)
 * stay that way. Behaviour, not a source scan: 401 without sign-in and 403
 * for a signed-in non-admin, before any handler or service runs. The real
 * routers and auth middleware; the services and models are stand-ins that
 * fail the test if they are ever called.
 */
const mockCalled = jest.fn();
const mockStub = () => new Proxy({}, { get: (_t, key) => (key === '__esModule' ? false : (...args) => mockCalled(key, args)) });

jest.mock('../../../src/services/cfoAgent', () => mockStub());
jest.mock('../../../src/services/siteOrganizerAgent', () => mockStub());
jest.mock('../../../src/services/designAgent', () => mockStub());
jest.mock('../../../src/models', () => ({ models: mockStub() }));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');

const app = express();
app.use(express.json());
app.use('/api/v1/cfo', require('../../../src/routes/cfoAgentRoutes'));
app.use('/api/v1/site-organizer', require('../../../src/routes/siteOrganizerRoutes'));
app.use('/api/v1/design-agent', require('../../../src/routes/designAgentRoutes'));
app.use('/api/v1/ai-usage', require('../../../src/routes/aiUsageRoutes'));
app.use('/api/v1/audit-logs', require('../../../src/routes/auditLogs'));

const userToken = TokenService.generateTokenPair({
  id: 'p0-tools-user', email: 'p0-tools@test.dev', name: 'p0', groups: ['USER', 'EDITOR'], role: 'USER',
}).accessToken;

const ROUTES = [
  ['get', '/api/v1/cfo/audit'], ['get', '/api/v1/cfo/agent/tokens'], ['get', '/api/v1/cfo/quick'],
  ['get', '/api/v1/cfo/history'], ['get', '/api/v1/cfo/scheduler'], ['post', '/api/v1/cfo/scheduler/start'],
  ['post', '/api/v1/cfo/scheduler/stop'], ['get', '/api/v1/cfo/budget'], ['put', '/api/v1/cfo/budget'],
  ['get', '/api/v1/site-organizer/scan'], ['get', '/api/v1/site-organizer/agent/routes'], ['get', '/api/v1/site-organizer/quick'],
  ['get', '/api/v1/design-agent/scan'], ['get', '/api/v1/design-agent/agent/tokens'], ['get', '/api/v1/design-agent/quick'],
  ['get', '/api/v1/ai-usage/cost-overview'], ['get', '/api/v1/ai-usage/summary'], ['get', '/api/v1/ai-usage/by-model'],
  ['get', '/api/v1/ai-usage/by-route'], ['get', '/api/v1/ai-usage/daily'], ['get', '/api/v1/ai-usage/recent'],
  ['get', '/api/v1/ai-usage/optimizations'], ['get', '/api/v1/ai-usage/cache-stats'],
  ['get', '/api/v1/audit-logs'], ['get', '/api/v1/audit-logs/stats'], ['get', '/api/v1/audit-logs/user/someone'],
];

describe('P0: the Admin › Tools APIs answer admins only', () => {
  beforeEach(() => mockCalled.mockClear());

  test.each(ROUTES.map(([m, p]) => [m.toUpperCase(), p, m]))('%s %s: 401 signed out, 403 for a non-admin', async (_M, path, m) => {
    expect((await request(app)[m](path)).status).toBe(401);
    const res = await request(app)[m](path).set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
    expect(mockCalled).not.toHaveBeenCalled();
  });
});
