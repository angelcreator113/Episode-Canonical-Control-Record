// ============================================================================
// UNIT TESTS — World cluster mixed Tier 1+3+4 disposition (Step 3 CP3)
// ============================================================================
// Tests for the 4-file World cluster sweep:
//   - WP1: lazy-noop fallback removed from 3 files
//     (world, worldEvents, worldStudio)
//   - WP2: 67 handlers promoted to Tier 1 (requireAuth)
//     (world × 4, worldEvents × 59 + 2 partial AI promote, worldTemperatureRoutes × 2)
//   - WP3: worldStudio.js mixed Tier 1+3+4 split (D1 lock)
//     - 1 Tier 3 (line 2483 generate-ecosystem-preview: factory invocation)
//     - 18 Tier 4 GETs (plain optionalAuth + PUBLIC comment)
//     - 34 mutations promoted to Tier 1 (22 POST + 6 PUT + 7 DELETE excl. line 2483)
//
// Decisions locked in CP3 surface:
//   D1: WorldStudio mixed disposition (revised from strict req.user matrix);
//       mutations default Tier 1 unless domain owner explicit adjudication
//   D2: Group-level PUBLIC comment text per surface §4 categorization
//   D3: worldTemperatureRoutes Tier 1 default
//   D4: worldEvents lines 1687 + 1889 partial-AI promoted (optionalAuth →
//       requireAuth; aiRateLimiter preserved)
//   D5: Anomaly 5 amendment — worldTemperatureRoutes has 2 handlers, NOT 0
//
// NEW architectural primitive (NEW v2.26 §9.11):
//   Mixed Tier 1+3+4 within single file (worldStudio.js).
//   Read vs write disposition discipline: req.user-consumption matrix is
//   read-only adjudication; mutations default Tier 1.

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', '..', '..', 'src', 'routes');
const readSrc = (name) => fs.readFileSync(path.join(ROUTES_DIR, name), 'utf8');

const CP3_FILES = [
  'world.js',
  'worldEvents.js',
  'worldStudio.js',
  'worldTemperatureRoutes.js',
];

// Per-file ref counts captured at CP3 close.
// requireAuth count = imports (1) + handler-level invocations (Tier 1 only).
// For worldStudio: 1 import + 34 mutations.
const REQUIRE_AUTH_COUNTS = {
  'world.js': 5,
  'worldEvents.js': 62,
  'worldStudio.js': 35,
  'worldTemperatureRoutes.js': 3,
};

const OPTIONAL_AUTH_COUNTS = {
  'world.js': 0,
  'worldEvents.js': 0,
  'worldStudio.js': 20, // 1 import + 18 Tier 4 plain + 1 Tier 3 factory
  'worldTemperatureRoutes.js': 0,
};

describe('Step 3 CP3 — World cluster mixed Tier 1+3+4 disposition', () => {
  describe('Per-file requireAuth consumer counts', () => {
    Object.entries(REQUIRE_AUTH_COUNTS).forEach(([filename, expected]) => {
      test(`${filename} contains exactly ${expected} requireAuth references`, () => {
        const src = readSrc(filename);
        const matches = src.match(/\brequireAuth\b/g) || [];
        expect(matches.length).toBe(expected);
      });
    });
  });

  describe('Per-file optionalAuth consumer counts', () => {
    Object.entries(OPTIONAL_AUTH_COUNTS).forEach(([filename, expected]) => {
      test(`${filename} contains exactly ${expected} optionalAuth references`, () => {
        const src = readSrc(filename);
        const matches = src.match(/\boptionalAuth\b/g) || [];
        expect(matches.length).toBe(expected);
      });
    });
  });

  describe('Lazy-noop fallback removed (WP1)', () => {
    const WP1_FILES = ['world.js', 'worldEvents.js', 'worldStudio.js'];
    WP1_FILES.forEach((filename) => {
      test(`${filename} has no lazy-noop ((req, res, next) => next()) or ((q, r, n) => n()) fallback`, () => {
        const src = readSrc(filename);
        expect(src).not.toMatch(/\(\(req,\s*res,\s*next\)\s*=>\s*next\(\)\)/);
        expect(src).not.toMatch(/\(\(q,\s*r,\s*n\)\s*=>\s*n\(\)\)/);
      });

      test(`${filename} no longer contains try/catch require pattern for auth import`, () => {
        const src = readSrc(filename);
        expect(src).not.toMatch(
          /try\s*\{[^}]*require\(['"]\.\.\/middleware\/auth['"]\)[\s\S]{0,200}\}\s*catch/,
        );
      });
    });

    test('world.js uses direct destructuring import for requireAuth', () => {
      expect(readSrc('world.js')).toMatch(
        /const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
    });

    test('worldEvents.js uses direct destructuring import for requireAuth + aiRateLimiter', () => {
      // After CP3 sweep, optionalAuth is no longer referenced in worldEvents.js
      // (all 59 plain optionalAuth handlers promoted to requireAuth + 2 partial AI POSTs
      // promoted from optionalAuth+aiRateLimiter to requireAuth+aiRateLimiter per D4 lock).
      const src = readSrc('worldEvents.js');
      expect(src).toMatch(
        /const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
      expect(src).toMatch(
        /const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/,
      );
    });

    test('worldStudio.js uses direct destructuring import for optionalAuth + requireAuth (mixed split)', () => {
      expect(readSrc('worldStudio.js')).toMatch(
        /const\s*\{\s*optionalAuth,\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
    });
  });

  describe('worldEvents.js AI POST gating (D4 lock — uniform requireAuth + aiRateLimiter)', () => {
    let src;
    beforeAll(() => {
      src = readSrc('worldEvents.js');
    });

    test('POST /events/:eventId/generate-script preserved verbatim (was already requireAuth + aiRateLimiter)', () => {
      expect(src).toMatch(
        /router\.post\(['"]\/world\/:showId\/events\/:eventId\/generate-script['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
    });

    test('POST /events/:eventId/generate-episode promoted (D4: optionalAuth + aiRateLimiter → requireAuth + aiRateLimiter)', () => {
      expect(src).toMatch(
        /router\.post\(['"]\/world\/:showId\/events\/:eventId\/generate-episode['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
    });

    test('POST /events/generate-episode-from-many preserved verbatim (was already requireAuth + aiRateLimiter)', () => {
      expect(src).toMatch(
        /router\.post\(['"]\/world\/:showId\/events\/generate-episode-from-many['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
    });

    test('POST /events/:eventId/regenerate-episode promoted (D4: optionalAuth + aiRateLimiter → requireAuth + aiRateLimiter)', () => {
      expect(src).toMatch(
        /router\.post\(['"]\/world\/:showId\/events\/:eventId\/regenerate-episode['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
    });

    test('all 4 AI handlers use uniform requireAuth + aiRateLimiter pattern', () => {
      const aiPattern = /router\.post\([^)]*requireAuth,\s*aiRateLimiter,/g;
      const matches = src.match(aiPattern) || [];
      expect(matches.length).toBe(4);
    });
  });

  describe('worldStudio.js mixed Tier 1+3+4 split (D1 lock)', () => {
    let src;
    beforeAll(() => {
      src = readSrc('worldStudio.js');
    });

    test('Tier 3 — POST /world/generate-ecosystem-preview uses optionalAuth({ degradeOnInfraFailure: true })', () => {
      expect(src).toMatch(
        /router\.post\(['"]\/world\/generate-ecosystem-preview['"],\s*optionalAuth\(\{\s*degradeOnInfraFailure:\s*true\s*\}\),/,
      );
    });

    test('Tier 3 — generate-ecosystem-preview has PUBLIC comment with audit handoff reference', () => {
      expect(src).toMatch(
        /\/\/\s*PUBLIC:\s*World ecosystem preview generation with ownership-when-authenticated[\s\S]*?Audit Handoff §4\.1\s*\n\s*router\.post\(['"]\/world\/generate-ecosystem-preview['"]/,
      );
    });

    test('Tier 4 — file has 18 PUBLIC group-rationale comments before plain-optionalAuth GETs', () => {
      const publicCommentCount = (src.match(/^\/\/ PUBLIC: World cluster read; published catalog data with no creator attribution per Item 15 lock$/gm) || []).length;
      expect(publicCommentCount).toBe(18);
    });

    test('Tier 4 — exactly 18 GET handlers use plain optionalAuth (not factory form)', () => {
      // Match "router.get(<...>, optionalAuth," NOT followed by `(`
      const tier4Pattern = /router\.get\([^)]*,\s*optionalAuth,/g;
      const matches = src.match(tier4Pattern) || [];
      expect(matches.length).toBe(18);
    });

    test('Tier 1 — exactly 34 mutation handlers use requireAuth (22 POST + 6 PUT + 7 DELETE excl. line 2483)', () => {
      // Mutations are POST/PUT/DELETE with requireAuth
      const postPattern = /router\.post\([^)]*,\s*requireAuth,/g;
      const putPattern = /router\.put\([^)]*,\s*requireAuth,/g;
      const deletePattern = /router\.delete\([^)]*,\s*requireAuth,/g;
      const postCount = (src.match(postPattern) || []).length;
      const putCount = (src.match(putPattern) || []).length;
      const deleteCount = (src.match(deletePattern) || []).length;
      expect(postCount).toBe(21); // 22 POST minus 1 Tier 3
      expect(putCount).toBe(6);
      expect(deleteCount).toBe(7);
      expect(postCount + putCount + deleteCount).toBe(34);
    });

    test('Tier 3 + Tier 4 + Tier 1 cover all 53 worldStudio handlers', () => {
      const handlerPattern = /^router\.(get|post|put|delete|patch)\(/gm;
      const matches = src.match(handlerPattern) || [];
      expect(matches.length).toBe(53);
    });

    test('F-AUTH-5 site at line ~2624 preserved (req.user?.id || req.ip || null)', () => {
      expect(src).toMatch(/const\s+ownerId\s*=\s*req\.user\?\.id\s*\|\|\s*req\.ip\s*\|\|\s*null/);
    });
  });

  describe('worldTemperatureRoutes.js Anomaly 5 amendment (D5 lock)', () => {
    let src;
    beforeAll(() => {
      src = readSrc('worldTemperatureRoutes.js');
    });

    test('file has 2 handlers (NOT 0 as v2.25 §5.5 stated) using custom worldTempRouter var', () => {
      const handlerPattern = /^worldTempRouter\.(get|post|put|delete|patch)\(/gm;
      const matches = src.match(handlerPattern) || [];
      expect(matches.length).toBe(2);
    });

    test('GET /:universeId uses requireAuth (Tier 1)', () => {
      expect(src).toMatch(
        /worldTempRouter\.get\(['"]\/:universeId['"],\s*requireAuth,/,
      );
    });

    test('POST /:universeId/snapshot uses requireAuth (Tier 1)', () => {
      expect(src).toMatch(
        /worldTempRouter\.post\(['"]\/:universeId\/snapshot['"],\s*requireAuth,/,
      );
    });
  });

  describe('world.js Tier 1 promotion (4 handlers)', () => {
    let src;
    beforeAll(() => {
      src = readSrc('world.js');
    });

    test('GET /world/:showId/history → requireAuth', () => {
      expect(src).toMatch(/router\.get\(['"]\/world\/:showId\/history['"],\s*requireAuth,/);
    });
    test('GET /world/:showId/decisions → requireAuth', () => {
      expect(src).toMatch(/router\.get\(['"]\/world\/:showId\/decisions['"],\s*requireAuth,/);
    });
    test('GET /world/:showId/stats → requireAuth', () => {
      expect(src).toMatch(/router\.get\(['"]\/world\/:showId\/stats['"],\s*requireAuth,/);
    });
    test('POST /world/:showId/browse-pool → requireAuth', () => {
      expect(src).toMatch(/router\.post\(['"]\/world\/:showId\/browse-pool['"],\s*requireAuth,/);
    });
  });

  describe('CP3 zone aggregate consumer counts', () => {
    test('CP3 zone contains 105 total requireAuth references across 4 files (4 imports + 101 handlers)', () => {
      const total = CP3_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        const matches = src.match(/\brequireAuth\b/g) || [];
        return sum + matches.length;
      }, 0);
      expect(total).toBe(105);
    });

    test('CP3 zone contains 20 total optionalAuth references (all in worldStudio.js)', () => {
      const total = CP3_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        const matches = src.match(/\boptionalAuth\b/g) || [];
        return sum + matches.length;
      }, 0);
      expect(total).toBe(20);
    });

    test('CP3 zone contains exactly 1 degradeOnInfraFailure: true factory invocation (worldStudio.js Tier 3)', () => {
      const total = CP3_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        const matches = src.match(/degradeOnInfraFailure:\s*true/g) || [];
        return sum + matches.length;
      }, 0);
      expect(total).toBe(1);
    });

    test('CP3 zone contains 19 PUBLIC comments (1 Tier 3 specific + 18 Tier 4 group)', () => {
      const total = CP3_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        const matches = src.match(/^\/\/ PUBLIC:/gm) || [];
        return sum + matches.length;
      }, 0);
      expect(total).toBe(19);
    });

    test('CP3 zone contains 0 authenticateToken active hits (planning forecast was 1; was lazy-noop fallback false positive)', () => {
      CP3_FILES.forEach((filename) => {
        const src = readSrc(filename);
        const stripped = src
          .split('\n')
          .filter((line) => !/^\s*\/\//.test(line))
          .join('\n');
        expect(stripped).not.toMatch(/\bauthenticateToken\b/);
      });
    });

    test('F-AUTH-3 baseline preserved: degradeOnInfraFailure consumer count outside CP3 zone unchanged from CP2 (5 in press + manuscript-export)', () => {
      const pressSrc = fs.readFileSync(path.join(ROUTES_DIR, 'press.js'), 'utf8');
      const manuscriptSrc = fs.readFileSync(path.join(ROUTES_DIR, 'manuscript-export.js'), 'utf8');
      const pattern = /degradeOnInfraFailure:\s*true/g;
      const pressCount = (pressSrc.match(pattern) || []).length;
      const manuscriptCount = (manuscriptSrc.match(pattern) || []).length;
      expect(pressCount).toBe(2);
      expect(manuscriptCount).toBe(3);
      expect(pressCount + manuscriptCount).toBe(5);
    });
  });
});
