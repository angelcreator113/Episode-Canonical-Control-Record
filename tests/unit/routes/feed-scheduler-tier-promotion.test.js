// ============================================================================
// UNIT TESTS — feedSchedulerRoutes.js (Step 3 CP8 — PROMOTE + service-mediated)
// ============================================================================
// 13 handlers (surface-correction: not 11) all Tier 1.
// 3 service-mediated AI POSTs aiRateLimiter per D3 (auto-generate,
// auto-generate-job, preview-sparks).
// Lazy-noop fallback removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'feedSchedulerRoutes.js'), 'utf8');

describe('Step 3 CP8 — feedSchedulerRoutes.js PROMOTE shape', () => {
  test('imports requireAuth + aiRateLimiter (lazy-noop removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  describe('Service-mediated AI POSTs (3 — D3 lock)', () => {
    ['/auto-generate', '/auto-generate-job', '/preview-sparks'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('Non-AI admin/control handlers (10)', () => {
    [
      ['get', '/status'], ['get', '/events'], ['get', '/history'],
      ['get', '/config'], ['put', '/config'],
      ['post', '/start'], ['post', '/stop'], ['post', '/run-now'], ['post', '/fill-one'],
      ['get', '/layer-status'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,\\s*(?:async|\\(req)`);
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
