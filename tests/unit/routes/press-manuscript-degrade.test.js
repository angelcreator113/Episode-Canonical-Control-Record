// ============================================================================
// UNIT TESTS — press.js + manuscript-export.js Tier 3 disposition (Step 3 CP1)
// ============================================================================
// Tests for the 5 Tier 3 handlers migrated to optionalAuth({
// degradeOnInfraFailure: true }) in CP1 WP2:
//   - press.js: GET /characters (line 455), GET /characters/:slug (line 501)
//   - manuscript-export.js: GET /book/:bookId/meta, /docx, /pdf
//
// Plus structural assertion (CP1 WP3): both files no longer use the
// ((q,r,n)=>n()) lazy-noop fallback pattern.
//
// CP1 scope per Decision 1 (LOCKED): press.js POSTs (4 handlers — lines 361,
// 531, 607, 696) deferred to CP10. This test file covers ONLY the 5 Tier 3
// GET handlers in CP1 scope.

const fs = require('fs');
const path = require('path');

describe('Step 3 CP1 — F-AUTH-3 Tier 3 handler disposition', () => {
  const PRESS_PATH = path.join(__dirname, '..', '..', '..', 'src', 'routes', 'press.js');
  const MANUSCRIPT_PATH = path.join(__dirname, '..', '..', '..', 'src', 'routes', 'manuscript-export.js');

  describe('press.js Tier 3 handlers (2 GETs)', () => {
    let pressSource;
    beforeAll(() => {
      pressSource = fs.readFileSync(PRESS_PATH, 'utf8');
    });

    test('GET /characters uses factory invocation with degradeOnInfraFailure: true', () => {
      expect(pressSource).toMatch(
        /router\.get\(['"]\/characters['"],\s*optionalAuth\(\{\s*degradeOnInfraFailure:\s*true\s*\}\)/,
      );
    });

    test('GET /characters/:slug uses factory invocation with degradeOnInfraFailure: true', () => {
      expect(pressSource).toMatch(
        /router\.get\(['"]\/characters\/:slug['"],\s*optionalAuth\(\{\s*degradeOnInfraFailure:\s*true\s*\}\)/,
      );
    });

    test('press.js POSTs (4 handlers) — CP12 migration to requireAuth (Tier 1) with D3-verified aiRateLimiter', () => {
      // CP12 §5.21 10th instance: Tier 1 + Tier 3 mix. The 4 POSTs (deferred from CP1)
      // are now requireAuth (Tier 1). D3-verified AI invocations: /generate-post and
      // /generate-scene call safeAI() — they get aiRateLimiter overlay per §5.43.
      // /seed-characters and /advance-career are Tier 1 only (no AI).
      expect(pressSource).toMatch(/router\.post\(['"]\/seed-characters['"],\s*requireAuth,/);
      expect(pressSource).toMatch(/router\.post\(['"]\/advance-career['"],\s*requireAuth,/);
      expect(pressSource).toMatch(/router\.post\(['"]\/generate-post['"],\s*requireAuth,\s*aiRateLimiter,/);
      expect(pressSource).toMatch(/router\.post\(['"]\/generate-scene['"],\s*requireAuth,\s*aiRateLimiter,/);
    });
  });

  describe('manuscript-export.js Tier 3 handlers (3 GETs)', () => {
    let manuscriptSource;
    beforeAll(() => {
      manuscriptSource = fs.readFileSync(MANUSCRIPT_PATH, 'utf8');
    });

    test('GET /book/:bookId/meta uses factory invocation with degradeOnInfraFailure: true', () => {
      expect(manuscriptSource).toMatch(
        /router\.get\(['"]\/book\/:bookId\/meta['"],\s*optionalAuth\(\{\s*degradeOnInfraFailure:\s*true\s*\}\)/,
      );
    });

    test('GET /book/:bookId/docx uses factory invocation with degradeOnInfraFailure: true', () => {
      expect(manuscriptSource).toMatch(
        /router\.get\(['"]\/book\/:bookId\/docx['"],\s*optionalAuth\(\{\s*degradeOnInfraFailure:\s*true\s*\}\)/,
      );
    });

    test('GET /book/:bookId/pdf uses factory invocation with degradeOnInfraFailure: true', () => {
      expect(manuscriptSource).toMatch(
        /router\.get\(['"]\/book\/:bookId\/pdf['"],\s*optionalAuth\(\{\s*degradeOnInfraFailure:\s*true\s*\}\)/,
      );
    });
  });

  describe('CP1 WP3 structural assertions — lazy-noop fallback removed', () => {
    test('press.js no longer contains ((q,r,n)=>n()) lazy-noop fallback', () => {
      const source = fs.readFileSync(PRESS_PATH, 'utf8');
      expect(source).not.toMatch(/\(\(q,\s*r,\s*n\)\s*=>\s*n\(\)\)/);
    });

    test('press.js no longer contains try/catch require pattern for auth import', () => {
      const source = fs.readFileSync(PRESS_PATH, 'utf8');
      // Pre-CP1 had: try { const m = require('../middleware/auth'); ... } catch ...
      expect(source).not.toMatch(/try\s*\{[^}]*require\(['"]\.\.\/middleware\/auth['"]\)[\s\S]{0,200}\}\s*catch/);
    });

    test('press.js uses direct destructuring import for auth middleware', () => {
      const source = fs.readFileSync(PRESS_PATH, 'utf8');
      expect(source).toMatch(
        /const\s*\{\s*optionalAuth[^}]*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
    });

    test('manuscript-export.js no longer contains ((req, res, next) => next()) lazy-noop fallback', () => {
      const source = fs.readFileSync(MANUSCRIPT_PATH, 'utf8');
      // Pre-CP1 had: optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
      // Match the specific 3-arg arrow noop, not bare next() callback expressions.
      expect(source).not.toMatch(
        /\|\|\s*\(\(req,\s*res,\s*next\)\s*=>\s*next\(\)\)/,
      );
    });

    test('manuscript-export.js no longer contains try/catch require pattern for auth import', () => {
      const source = fs.readFileSync(MANUSCRIPT_PATH, 'utf8');
      expect(source).not.toMatch(/try\s*\{[^}]*require\(['"]\.\.\/middleware\/auth['"]\)[\s\S]{0,200}\}\s*catch/);
    });

    test('manuscript-export.js uses direct destructuring import for auth middleware', () => {
      const source = fs.readFileSync(MANUSCRIPT_PATH, 'utf8');
      expect(source).toMatch(
        /const\s*\{\s*optionalAuth[^}]*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
    });
  });

  describe('F-AUTH-3 consumer count post-CP1', () => {
    test('press.js + manuscript-export.js together contain exactly 5 degradeOnInfraFailure: true invocations', () => {
      const pressSource = fs.readFileSync(PRESS_PATH, 'utf8');
      const manuscriptSource = fs.readFileSync(MANUSCRIPT_PATH, 'utf8');
      const pattern = /degradeOnInfraFailure:\s*true/g;
      const pressCount = (pressSource.match(pattern) || []).length;
      const manuscriptCount = (manuscriptSource.match(pattern) || []).length;
      expect(pressCount).toBe(2);
      expect(manuscriptCount).toBe(3);
      expect(pressCount + manuscriptCount).toBe(5);
    });
  });
});
