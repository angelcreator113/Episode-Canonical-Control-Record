/**
 * SEC-3 (Evoni's admin-only ruling, 2026-10-29): /api/decision-analytics is
 * admin only. Every route was optionalAuth, and GET /export returned the
 * decision rows with their user ids and full context to anyone. The real
 * router and auth middleware; the analytics service is a stand-in.
 */
jest.mock('../../../src/services/decisionAnalyticsService', () => ({
  getOverallStats: jest.fn(async () => ({})),
  getDecisionsByType: jest.fn(async () => []),
  getTopChoices: jest.fn(async () => []),
  getDecisionTimeline: jest.fn(async () => []),
  detectPatterns: jest.fn(async () => ({})),
  getDecisionDistribution: jest.fn(async () => []),
  exportForTraining: jest.fn(async () => ({ decisions: [{ user_id: 'someone', context: {} }] })),
}));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const analytics = require('../../../src/services/decisionAnalyticsService');

const app = express();
app.use('/api/decision-analytics', require('../../../src/routes/decisionAnalytics'));

const token = (groups) => TokenService.generateTokenPair({ id: `sec3-${groups.join('-') || 'none'}`, email: 'sec3@test.dev', name: 'sec3', groups, role: groups[0] }).accessToken;
const PATHS = ['/stats', '/by-type', '/top-choices/outfit', '/timeline?interval=day', '/patterns', '/distribution/outfit', '/export', '/export?format=csv'];
const get = (p, auth) => {
  const r = request(app).get(`/api/decision-analytics${p}`);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

describe('SEC-3: decision analytics are admin only', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each(PATHS)('GET %s: 401 without sign-in, 403 for a non-admin, no data read', async (p) => {
    expect((await get(p, null)).status).toBe(401);
    expect((await get(p, token(['USER']))).status).toBe(403);
    for (const fn of Object.values(analytics)) expect(fn).not.toHaveBeenCalled();
  });

  test('an admin gets the export', async () => {
    const res = await get('/export', token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(analytics.exportForTraining).toHaveBeenCalledTimes(1);
  });
});
