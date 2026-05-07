// ============================================================================
// UNIT TESTS — Scene cluster pure Tier 1 sweep + AI POST reference model (Step 3 CP4)
// ============================================================================
// Tests for the 6-file Scene cluster sweep:
//   - WP1 NO-OP: 0 lazy-noop in CP4 zone (planning §A.7 forecast 2-4 — surface correction)
//   - WP2: 113 handlers promoted to Tier 1 (requireAuth)
//   - WP3: 13 AI POSTs promoted per worldEvents reference model (D1 lock)
//     (1 in sceneProposeRoute.js + 12 in sceneSetRoutes.js)
//
// Decisions locked in CP4 surface:
//   D1: 13 AI POSTs uniformly promoted to requireAuth + aiRateLimiter
//   D2: sceneLinks.js mount-path anomaly preserved (PE-10 in v2.28 §9.12)
//   D3: sceneTemplates.js → Tier 1 default (no PUBLIC adjudication needed)
//   D4: aggregate-counter test methodology (per v2.27 §5.30)
//   D5: scenes.js diagnostic endpoints (/test-direct, /ultra-test, /db-test) → Tier 1 default
//
// CP4 architectural findings:
//   - First CP with WP1 no-op (zero lazy-noop in CP4 zone)
//   - First CP with NO Track 7 mini-CP coordination needed (frontend services
//     already use apiClient — ideal state)
//   - First pure Tier 1 sweep CP in Step 3 (no Tier 2/3/4/5 candidates)
//   - Mount-collision third topology shape: distinct-mounts variant
//   - 13 AI POSTs (second instance of v2.26 §5.27 worldEvents reference model)

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', '..', '..', 'src', 'routes');
const readSrc = (name) => fs.readFileSync(path.join(ROUTES_DIR, name), 'utf8');

const CP4_FILES = [
  'scenes.js',
  'sceneTemplates.js',
  'sceneLibrary.js',
  'sceneProposeRoute.js',
  'sceneSetRoutes.js',
  'sceneLinks.js',
];

// Per-file requireAuth counts captured at CP4 close (1 import + handler-level invocations).
const REQUIRE_AUTH_COUNTS = {
  'scenes.js': 37,             // 1 import + 36 handlers
  'sceneTemplates.js': 6,      // 1 import + 5 handlers
  'sceneLibrary.js': 6,        // 1 import + 5 handlers (3 ex-authenticateToken + 2 ex-bare)
  'sceneProposeRoute.js': 7,   // 1 import + 6 handlers (1 with aiRateLimiter)
  'sceneSetRoutes.js': 71,     // 1 import + 70 handlers (12 with aiRateLimiter)
  'sceneLinks.js': 5,          // 1 import + 4 handlers
};

// Per-file aiRateLimiter match counts (\baiRateLimiter\b — note import line has 2 matches:
// `{ aiRateLimiter }` destructure + `'../middleware/aiRateLimiter'` module path).
const AI_RATE_LIMITER_COUNTS = {
  'scenes.js': 0,
  'sceneTemplates.js': 0,
  'sceneLibrary.js': 0,
  'sceneProposeRoute.js': 3,   // 2 import-line matches + 1 handler (POST /propose-scene)
  'sceneSetRoutes.js': 14,     // 2 import-line matches + 12 handler invocations
  'sceneLinks.js': 0,
};

describe('Step 3 CP4 — Scene cluster pure Tier 1 sweep + AI POST reference model', () => {
  describe('Per-file requireAuth consumer counts', () => {
    Object.entries(REQUIRE_AUTH_COUNTS).forEach(([filename, expected]) => {
      test(`${filename} contains exactly ${expected} requireAuth references`, () => {
        const src = readSrc(filename);
        const matches = src.match(/\brequireAuth\b/g) || [];
        expect(matches.length).toBe(expected);
      });
    });
  });

  describe('Per-file aiRateLimiter consumer counts (D1 — 13 AI POSTs uniformly promoted)', () => {
    Object.entries(AI_RATE_LIMITER_COUNTS).forEach(([filename, expected]) => {
      test(`${filename} contains exactly ${expected} aiRateLimiter references`, () => {
        const src = readSrc(filename);
        const matches = src.match(/\baiRateLimiter\b/g) || [];
        expect(matches.length).toBe(expected);
      });
    });
  });

  describe('CP4 zone hygiene — no legacy auth patterns', () => {
    CP4_FILES.forEach((filename) => {
      test(`${filename} has no optionalAuth references`, () => {
        const src = readSrc(filename);
        expect(src).not.toMatch(/\boptionalAuth\b/);
      });

      test(`${filename} has no active authenticateToken references`, () => {
        const src = readSrc(filename);
        const stripped = src
          .split('\n')
          .filter((line) => !/^\s*\/\//.test(line))
          .join('\n');
        expect(stripped).not.toMatch(/\bauthenticateToken\b/);
      });

      test(`${filename} has no lazy-noop fallback`, () => {
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
  });

  describe('Direct destructuring imports (post-WP1 no-op clean baseline)', () => {
    test('scenes.js imports requireAuth via destructuring', () => {
      expect(readSrc('scenes.js')).toMatch(
        /const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
    });
    test('sceneTemplates.js imports requireAuth via destructuring (NEW import)', () => {
      expect(readSrc('sceneTemplates.js')).toMatch(
        /const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
    });
    test('sceneLibrary.js imports requireAuth (renamed from authenticateToken)', () => {
      expect(readSrc('sceneLibrary.js')).toMatch(
        /const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
    });
    test('sceneProposeRoute.js imports requireAuth + aiRateLimiter (NEW aiRateLimiter)', () => {
      const src = readSrc('sceneProposeRoute.js');
      expect(src).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
      expect(src).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
    });
    test('sceneSetRoutes.js imports requireAuth + aiRateLimiter (NEW aiRateLimiter)', () => {
      const src = readSrc('sceneSetRoutes.js');
      expect(src).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
      expect(src).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
    });
    test('sceneLinks.js imports requireAuth via destructuring (NEW import)', () => {
      expect(readSrc('sceneLinks.js')).toMatch(
        /const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
    });
  });

  describe('AI POST reference model application (D1 — 13 sites uniformly requireAuth + aiRateLimiter)', () => {
    test('sceneProposeRoute.js — POST /propose-scene wrapped requireAuth + aiRateLimiter', () => {
      expect(readSrc('sceneProposeRoute.js')).toMatch(
        /router\.post\(['"]\/propose-scene['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
    });

    const SCENE_SET_AI_POSTS = [
      '/:id/analyze-image',
      '/:id/generate-base',
      '/:id/angles/:angleId/generate',
      '/:id/angles/:angleId/generate-video',
      '/:id/angles/:angleId/analyze',
      '/:id/angles/:angleId/regenerate',
      '/:id/cascade-regenerate',
      '/:id/spec/generate',
      '/:id/generate-object',
      '/:id/regenerate-background',
      '/:id/angles/:angleId/generate-depth',
      '/:id/generate-all-angles',
    ];

    SCENE_SET_AI_POSTS.forEach((p) => {
      test(`sceneSetRoutes.js — POST ${p} wrapped requireAuth + aiRateLimiter`, () => {
        // Allow validateUUIDParam('id') between path and requireAuth
        const escaped = p.replace(/[/]/g, '\\/').replace(/:/g, ':');
        const re = new RegExp(
          `router\\.post\\(['"]${escaped}['"],\\s*validateUUIDParam\\('id'\\),\\s*requireAuth,\\s*aiRateLimiter,`,
        );
        expect(readSrc('sceneSetRoutes.js')).toMatch(re);
      });
    });

    test('sceneSetRoutes.js — exactly 12 requireAuth + aiRateLimiter middleware-chain occurrences', () => {
      const src = readSrc('sceneSetRoutes.js');
      const matches = src.match(/requireAuth,\s*aiRateLimiter,/g) || [];
      expect(matches.length).toBe(12);
    });
  });

  describe('PE-10 mount-path anomaly preserved (D2 lock)', () => {
    test('sceneLinks.js still mounted at /api/scene-links (no /api/v1/) per PE-10', () => {
      // app.js mount unchanged; CP4 does not fix path anomaly.
      const appSrc = fs.readFileSync(path.join(ROUTES_DIR, '..', 'app.js'), 'utf8');
      expect(appSrc).toMatch(/app\.use\(['"]\/api\/scene-links['"],\s*sceneLinksRoutes\)/);
    });
  });

  describe('CP4 zone aggregate consumer counts', () => {
    test('CP4 zone contains 132 total requireAuth references across 6 files (6 imports + 126 handlers)', () => {
      const total = CP4_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        const matches = src.match(/\brequireAuth\b/g) || [];
        return sum + matches.length;
      }, 0);
      expect(total).toBe(132);
    });

    test('CP4 zone contains 17 total aiRateLimiter references (4 import-line matches + 13 handler invocations)', () => {
      // sceneProposeRoute.js (3) + sceneSetRoutes.js (14) = 17.
      // Import lines have 2 matches each (destructure + module path) since
      // 'aiRateLimiter' appears in both `{ aiRateLimiter }` and `'.../aiRateLimiter'`.
      const total = CP4_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        const matches = src.match(/\baiRateLimiter\b/g) || [];
        return sum + matches.length;
      }, 0);
      expect(total).toBe(17);
    });

    test('CP4 zone has zero optionalAuth references', () => {
      const total = CP4_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        const matches = src.match(/\boptionalAuth\b/g) || [];
        return sum + matches.length;
      }, 0);
      expect(total).toBe(0);
    });

    test('F-AUTH-3 baseline preserved: degradeOnInfraFailure consumer count unchanged from CP3', () => {
      // CP4 introduces no Tier 3 handlers; press.js + manuscript-export.js + worldStudio.js:2483
      // remain the only Tier 3 consumers (5 in routes + 2 docstrings in middleware/auth.js + 1 from CP3).
      const pressSrc = readSrc('press.js');
      const manuscriptSrc = readSrc('manuscript-export.js');
      const worldStudioSrc = readSrc('worldStudio.js');
      const pattern = /degradeOnInfraFailure:\s*true/g;
      expect((pressSrc.match(pattern) || []).length).toBe(2);
      expect((manuscriptSrc.match(pattern) || []).length).toBe(3);
      expect((worldStudioSrc.match(pattern) || []).length).toBe(1);
    });
  });
});
