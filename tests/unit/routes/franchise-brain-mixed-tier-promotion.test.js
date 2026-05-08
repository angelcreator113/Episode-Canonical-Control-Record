// ============================================================================
// UNIT TESTS — franchiseBrainRoutes.js Q13 mixed Tier 1+4 (Step 3 CP7, D2 lock)
// ============================================================================
// 16 handlers in src/routes/franchiseBrainRoutes.js:
//   - 11 writes (POST/PATCH/DELETE) → Tier 1 (requireAuth)
//   - 5 GETs                         → Tier 4 PUBLIC (plain optionalAuth, no req.user gate)
//   - 2 AI POSTs (/ingest-document, /push-from-page) additionally get aiRateLimiter
//   - Legacy authenticateToken at L560 (push-from-page) converted to requireAuth (D3)
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

  describe('AI POSTs (2 — D2 + D3 locks)', () => {
    test('POST /franchise-brain/ingest-document → requireAuth + aiRateLimiter', () => {
      expect(SRC).toMatch(/router\.post\('\/franchise-brain\/ingest-document',\s*requireAuth,\s*aiRateLimiter,\s*async/);
    });
    test('POST /franchise-brain/push-from-page → requireAuth + aiRateLimiter (D3 — converted from legacy authenticateToken)', () => {
      expect(SRC).toMatch(/router\.post\('\/franchise-brain\/push-from-page',\s*requireAuth,\s*aiRateLimiter,\s*async/);
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
