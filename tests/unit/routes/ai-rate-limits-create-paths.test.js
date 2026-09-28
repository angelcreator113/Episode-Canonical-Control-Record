// ============================================================================
// UNIT TESTS — aiRateLimiter on two model-calling create routes (Task #2152)
// ============================================================================
// docs/EVENT_CREATE_PATHS_READ.md §2 found two routes that call a model
// without aiRateLimiter:
//   - POST /api/v1/feed-pipeline/:showId/schedule/:opportunityId
//     ("Schedule as Event"; scheduleOpportunityAsEvent → generateUniqueVenue,
//     one Haiku 4.5 call per event)
//   - POST /api/v1/calendar/events/generate-seasonal
//     ("Auto-Fill This Month" step 1; generateSeasonalEvents, one Sonnet 4.6
//     call)
// Both now carry requireAuth + aiRateLimiter, in that order. Source-text
// checks, in the style of world-cluster-tier-promotion.test.js.

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', '..', '..', 'src', 'routes');
const readSrc = (name) => fs.readFileSync(path.join(ROUTES_DIR, name), 'utf8');

describe('Task #2152 — aiRateLimiter on Schedule as Event and generate-seasonal', () => {
  describe('feedPipelineRoutes.js', () => {
    const src = readSrc('feedPipelineRoutes.js');

    test('imports aiRateLimiter', () => {
      expect(src).toMatch(
        /const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/,
      );
    });

    test('POST /:showId/schedule/:opportunityId → requireAuth + aiRateLimiter', () => {
      expect(src).toMatch(
        /router\.post\(['"]\/:showId\/schedule\/:opportunityId['"],\s*requireAuth,\s*aiRateLimiter,\s*async/,
      );
    });
  });

  describe('calendarRoutes.js', () => {
    const src = readSrc('calendarRoutes.js');

    test('imports aiRateLimiter', () => {
      expect(src).toMatch(
        /const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/,
      );
    });

    test('POST /events/generate-seasonal → requireAuth + aiRateLimiter', () => {
      expect(src).toMatch(
        /router\.post\(['"]\/events\/generate-seasonal['"],\s*requireAuth,\s*aiRateLimiter,\s*async/,
      );
    });
  });
});
