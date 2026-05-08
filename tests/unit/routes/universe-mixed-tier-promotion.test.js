// ============================================================================
// UNIT TESTS — universe Q13 mixed Tier 1+4 disposition (Step 3 CP6, D2 lock)
// ============================================================================
// 8 handlers in src/routes/universe.js:
//   - 4 writes (POST/PUT/DELETE) → Tier 1 (requireAuth)
//   - 4 GETs                      → Tier 4 PUBLIC (plain optionalAuth, no req.user gate)
//
// Per F-AUTH-1 fix plan v2.30 §5.21 — mixed Tier 1+4 within single file
// architectural primitive, 2nd cumulative instance after worldStudio.js at CP3.
// Lazy-noop fallback at L24-29 removed in same commit.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'universe.js'), 'utf8');

describe('Step 3 CP6 — universe Q13 mixed Tier 1+4 disposition', () => {
  test('imports requireAuth + optionalAuth from middleware/auth (mixed-tier import shape)', () => {
    expect(SRC).toMatch(/const\s*\{\s*optionalAuth,\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  describe('Tier 1 writes (D2 lock — 4 mutations require auth)', () => {
    test("POST '/' (create universe) requires auth", () => {
      expect(SRC).toMatch(/router\.post\('\/',\s*requireAuth,\s*async/);
    });
    test("POST '/series' (create series) requires auth", () => {
      expect(SRC).toMatch(/router\.post\('\/series',\s*requireAuth,\s*async/);
    });
    test("PUT '/series/:id' (update series) requires auth", () => {
      expect(SRC).toMatch(/router\.put\('\/series\/:id',\s*requireAuth,\s*async/);
    });
    test("DELETE '/series/:id' (delete series) requires auth", () => {
      expect(SRC).toMatch(/router\.delete\('\/series\/:id',\s*requireAuth,\s*async/);
    });
    test("PUT '/:id' (update universe) requires auth", () => {
      expect(SRC).toMatch(/router\.put\('\/:id',\s*requireAuth,\s*async/);
    });
  });

  describe('Tier 4 PUBLIC reads (D2 lock — 4 GETs no auth gate)', () => {
    test("GET '/' (list universes) uses optionalAuth — Tier 4", () => {
      expect(SRC).toMatch(/router\.get\('\/',\s*optionalAuth,\s*async/);
    });
    test("GET '/series' (list series) uses optionalAuth — Tier 4", () => {
      expect(SRC).toMatch(/router\.get\('\/series',\s*optionalAuth,\s*async/);
    });
    test("GET '/:id' (get universe with series) uses optionalAuth — Tier 4", () => {
      expect(SRC).toMatch(/router\.get\('\/:id',\s*optionalAuth,\s*async/);
    });
    test('Tier 4 GET handlers do NOT consume req.user inside their bodies (catalog reads, not personalized)', () => {
      // Extract each GET handler body and verify no req.user reads.
      const getHandlerBodies = SRC.match(/router\.get\('[^']+',\s*optionalAuth,\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?\n\}\);/g) || [];
      expect(getHandlerBodies.length).toBeGreaterThanOrEqual(3);
      getHandlerBodies.forEach((body) => {
        expect(body).not.toMatch(/req\.user/);
      });
    });
  });

  describe('CP6 zone hygiene', () => {
    test('lazy-noop fallback at L24-29 has been removed', () => {
      expect(SRC).not.toMatch(/\(\(req,\s*res,\s*next\)\s*=>\s*next\(\)\)/);
    });
    test('no try/catch require pattern around middleware/auth import', () => {
      expect(SRC).not.toMatch(/try\s*\{[\s\S]{0,200}require\(['"]\.\.\/middleware\/auth['"]\)/);
    });
    test('mixed-tier comment block documents §5.21 application', () => {
      expect(SRC).toMatch(/§5\.21|mixed Tier 1\+4/);
    });
  });
});
