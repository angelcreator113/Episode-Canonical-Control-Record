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
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
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

  describe('Scheduler controls are admin only (SEC-4, 2026-10-29)', () => {
    test('one admin guard: requireAuth + authorize ADMIN', () => {
      expect(SRC).toMatch(/const admin = \[requireAuth, authorize\(\['ADMIN'\]\)\];/);
    });
    [['/start', true], ['/stop', false], ['/run-now', true], ['/fill-one', true]].forEach(([route, paid]) => {
      test(`POST ${route} → admin${paid ? ' + aiRateLimiter' : ''}`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.post\\('${escaped}',\\s*\\.\\.\\.admin,\\s*${paid ? 'aiRateLimiter,\\s*' : ''}(?:async|\\(req)`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('Non-AI handlers (6)', () => {
    [
      ['get', '/status'], ['get', '/events'], ['get', '/history'],
      ['get', '/config'], ['put', '/config'],
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
