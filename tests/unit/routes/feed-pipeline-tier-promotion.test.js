// ============================================================================
// UNIT TESTS — feedPipelineRoutes.js (Step 3 CP8 — PROMOTE)
// ============================================================================
// 3 handlers all Tier 1.
// 2 service-mediated AI POSTs with aiRateLimiter (generate-opportunities;
// schedule, since Task #2152).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'feedPipelineRoutes.js'), 'utf8');

describe('Step 3 CP8 — feedPipelineRoutes.js PROMOTE shape', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('AI POST /:showId/generate-opportunities → requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/:showId\/generate-opportunities',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  // Task #2152: not non-AI — scheduleOpportunityAsEvent calls Haiku for the
  // venue line (generateUniqueVenue), so it now carries aiRateLimiter too.
  test('POST /:showId/schedule/:opportunityId → requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/:showId\/schedule\/:opportunityId',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  test('GET /:showId/suggestions → requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/:showId\/suggestions',\s*requireAuth,\s*async/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
