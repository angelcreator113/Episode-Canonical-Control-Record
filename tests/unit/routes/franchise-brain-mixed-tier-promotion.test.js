// ============================================================================
// UNIT TESTS — franchiseBrainRoutes.js Q13 mixed Tier 1+4 (Step 3 CP7, D2 lock)
// ============================================================================
// 15 handlers in src/routes/franchiseBrainRoutes.js:
//   - 10 writes (POST/PATCH/DELETE) → Tier 1 (requireAuth)
//   - 5 GETs                         → Tier 4 PUBLIC (plain optionalAuth, no req.user gate)
//   - 1 AI POST (/ingest-document) additionally gets aiRateLimiter
//   - Legacy authenticateToken at L560 (push-from-page) converted to requireAuth (D3);
//     push-from-page itself retired 2026-10-03 (Brain Update; docs/BRAIN_OWNERSHIP.md):
//     pages sync through routes/brainSyncRoutes.js instead
//
// Per F-AUTH-1 fix plan v2.31 §5.21 — mixed Tier 1+4 within single file
// architectural primitive, 3rd cumulative instance after worldStudio.js at CP3
// + universe.js at CP6.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'franchiseBrainRoutes.js'), 'utf8');

describe('Step 3 CP7 — franchiseBrainRoutes.js Q13 mixed Tier 1+4', () => {
  test('imports optionalAuth + requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*optionalAuth,\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  describe('Tier 4 PUBLIC GETs (5 catalog reads — D2 lock)', () => {
    ['/franchise-brain/entries', '/franchise-brain/amber-activity',
     '/franchise-brain/documents', '/franchise-brain/documents/:id', '/multi-product/all'].forEach((route) => {
      test(`GET ${route} uses optionalAuth (Tier 4 PUBLIC)`, () => {
        const re = new RegExp(`router\\.get\\('${route.replace(/\//g, '\\/')}',\\s*optionalAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('Tier 1 writes (11 mutations require auth — D2 lock)', () => {
    [
      ['post', '/franchise-brain/seed'],
      ['post', '/franchise-brain/entries'],
      ['patch', '/franchise-brain/entries/:id/activate'],
      ['post', '/franchise-brain/activate-all'],
      ['patch', '/franchise-brain/entries/:id'],
      ['delete', '/franchise-brain/entries/:id'],
      ['patch', '/franchise-brain/entries/:id/archive'],
      ['patch', '/franchise-brain/entries/:id/unarchive'],
      ['post', '/franchise-brain/guard'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const re = new RegExp(`router\\.${verb}\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth\\b`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('AI POSTs (1 — D2 lock; push-from-page retired)', () => {
    test('POST /franchise-brain/ingest-document → requireAuth + aiRateLimiter', () => {
      expect(SRC).toMatch(/router\.post\('\/franchise-brain\/ingest-document',\s*requireAuth,\s*aiRateLimiter,\s*async/);
    });
    test('POST /franchise-brain/push-from-page is retired: no handler remains (Brain Update)', () => {
      expect(SRC).not.toMatch(/router\.\w+\('\/franchise-brain\/push-from-page'/);
    });
  });

  describe('D3 — legacy authenticateToken eliminated', () => {
    test('no authenticateToken references remain anywhere in the file', () => {
      expect(SRC).not.toMatch(/\bauthenticateToken\b/);
    });
  });

  describe('Mixed-tier comment block per §5.21', () => {
    test('documents 3rd cumulative §5.21 mixed Tier 1+4 application', () => {
      expect(SRC).toMatch(/§5\.21|mixed Tier 1\+4/);
      expect(SRC).toMatch(/3rd cumulative instance/);
    });
  });
});
