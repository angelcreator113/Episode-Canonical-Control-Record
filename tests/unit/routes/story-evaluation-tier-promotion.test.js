// ============================================================================
// UNIT TESTS — storyEvaluationRoutes.js (Step 3 CP7 — PROMOTE shape)
// ============================================================================
// 8 handlers all Tier 1 + 5 AI POSTs get aiRateLimiter.
// Lazy-noop fallback at L27-33 removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'storyEvaluationRoutes.js'), 'utf8');

describe('Step 3 CP7 — storyEvaluationRoutes.js PROMOTE shape', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  describe('Tier 1 + aiRateLimiter (5 AI POSTs)', () => {
    ['/generate-story-multi', '/evaluate-stories', '/propose-memory', '/propose-registry-update', '/scene-revelation'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('Non-AI handlers (3) — requireAuth only', () => {
    [['post', '/write-back'], ['get', '/eval-stories/:storyId'], ['get', '/eval-stories/:storyId/enrichment']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });

  test('no lazy-noop fallback', () => {
    expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try/);
  });
});
