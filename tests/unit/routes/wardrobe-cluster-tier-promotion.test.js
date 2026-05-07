// ============================================================================
// UNIT TESTS — Wardrobe cluster pure Tier 1 sweep + AI POST + Item 16 + audit §4.1(b) (Step 3 CP5)
// ============================================================================
// Tests for the 7-file Wardrobe cluster sweep:
//   - WP1: lazy-noop fallback removed from 3 files (wardrobe, wardrobeLibrary, wardrobeBrands)
//   - WP2: 74 handlers promoted to Tier 1 (requireAuth)
//   - WP3: 12 AI POSTs ADD shape per worldEvents reference model (D1 lock)
//   - Item 16 closure: wardrobeLibrary.js dev-mode auth-bypass eliminated (D2 escalated to requireAuth)
//   - audit §4.1(b) Sweep b closure: outfitSets.js 5 routes ADDed requireAuth (D3); pairs with CP2 D5
//
// Decisions locked in CP5 surface:
//   D1: 12 AI POSTs uniformly promoted to requireAuth + aiRateLimiter (ADD shape)
//   D2: Item 16 escalated to requireAuth (was originally `authenticate`); env-conditional eliminated
//   D3: outfitSets.js audit §4.1(b) closure — 5 routes ADDed requireAuth
//   D4: aggregate-counter test methodology
//   D5: wardrobe.js 7 bare AI POSTs single-edit ADD shape

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', '..', '..', 'src', 'routes');
const readSrc = (name) => fs.readFileSync(path.join(ROUTES_DIR, name), 'utf8');

const CP5_FILES = [
  'wardrobe.js',
  'wardrobeLibrary.js',
  'wardrobeBrands.js',
  'wardrobeEventRoutes.js',
  'outfitSets.js',
  'hairLibraryRoutes.js',
  'makeupLibraryRoutes.js',
];

// Per-file requireAuth match counts (\brequireAuth\b — note import line is 1 match).
const REQUIRE_AUTH_COUNTS = {
  'wardrobe.js': 35,            // 1 import + 34 handlers
  'wardrobeLibrary.js': 26,     // 1 import + 25 handlers
  'wardrobeBrands.js': 8,       // 1 import + 7 handlers
  'wardrobeEventRoutes.js': 4,  // 1 import + 3 handlers
  'outfitSets.js': 6,           // 1 import + 5 handlers (audit §4.1(b) closure)
  'hairLibraryRoutes.js': 7,    // 1 import + 6 handlers
  'makeupLibraryRoutes.js': 7,  // 1 import + 6 handlers
};

// Per-file aiRateLimiter match counts (\baiRateLimiter\b — note import line has 2 matches:
// `{ aiRateLimiter }` destructure + `'../middleware/aiRateLimiter'` module path).
const AI_RATE_LIMITER_COUNTS = {
  'wardrobe.js': 10,            // 2 import-line + 8 handlers
  'wardrobeLibrary.js': 3,      // 2 import-line + 1 handler
  'wardrobeBrands.js': 3,       // 2 import-line + 1 handler
  'wardrobeEventRoutes.js': 0,
  'outfitSets.js': 0,
  'hairLibraryRoutes.js': 3,    // 2 import-line + 1 handler
  'makeupLibraryRoutes.js': 3,  // 2 import-line + 1 handler
};

describe('Step 3 CP5 — Wardrobe cluster Tier 1 sweep + AI POST + Item 16 + audit §4.1(b)', () => {
  describe('Per-file requireAuth consumer counts', () => {
    Object.entries(REQUIRE_AUTH_COUNTS).forEach(([filename, expected]) => {
      test(`${filename} contains exactly ${expected} requireAuth references`, () => {
        const src = readSrc(filename);
        const matches = src.match(/\brequireAuth\b/g) || [];
        expect(matches.length).toBe(expected);
      });
    });
  });

  describe('Per-file aiRateLimiter consumer counts (D1 — 12 AI POSTs ADD shape)', () => {
    Object.entries(AI_RATE_LIMITER_COUNTS).forEach(([filename, expected]) => {
      test(`${filename} contains exactly ${expected} aiRateLimiter references`, () => {
        const src = readSrc(filename);
        const matches = src.match(/\baiRateLimiter\b/g) || [];
        expect(matches.length).toBe(expected);
      });
    });
  });

  describe('CP5 zone hygiene — no legacy auth patterns', () => {
    CP5_FILES.forEach((filename) => {
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

  describe('Item 16 closure (D2 — wardrobeLibrary.js dev-mode auth-bypass eliminated)', () => {
    let src;
    beforeAll(() => {
      src = readSrc('wardrobeLibrary.js');
    });

    test('isDevelopment constant absent (Item 16 sentinel)', () => {
      expect(src).not.toMatch(/\bisDevelopment\b/);
    });

    test('authMiddleware const absent (Item 16 sentinel)', () => {
      expect(src).not.toMatch(/\bauthMiddleware\b/);
    });

    test("'dev-user' literal absent (Item 16 sentinel)", () => {
      expect(src).not.toMatch(/dev-user/);
    });

    test('authenticate (legacy alias) no longer in active use', () => {
      // The original Item 16 had `: authenticate` as the non-dev branch.
      // Post-CP5 D2 escalation: replaced with requireAuth everywhere.
      const stripped = src
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line))
        .join('\n');
      expect(stripped).not.toMatch(/\bauthenticate\b/);
    });
  });

  describe('outfitSets.js audit §4.1(b) closure (D3 — 5 routes ADDed requireAuth)', () => {
    let src;
    beforeAll(() => {
      src = readSrc('outfitSets.js');
    });

    test('outfitSets.js imports requireAuth via destructuring (NEW import)', () => {
      expect(src).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    });

    const ROUTES = [
      ["router.get('/'", 'listOutfitSets'],
      ["router.get('/:id'", 'getOutfitSet'],
      ["router.post('/'", 'createOutfitSet'],
      ["router.put('/:id'", 'updateOutfitSet'],
      ["router.delete('/:id'", 'deleteOutfitSet'],
    ];

    ROUTES.forEach(([prefix, ctrl]) => {
      test(`${prefix} wraps requireAuth + outfitSetController.${ctrl}`, () => {
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`${escapedPrefix},\\s*requireAuth,\\s*outfitSetController\\.${ctrl}`);
        expect(src).toMatch(re);
      });
    });
  });

  describe('AI POST reference model application (D1 — 12 sites uniformly requireAuth + aiRateLimiter)', () => {
    test('wardrobe.js — 8 router.post lines wrap requireAuth + aiRateLimiter', () => {
      const src = readSrc('wardrobe.js');
      const matches = src.match(/router\.post\([^)]*requireAuth,\s*aiRateLimiter,/g) || [];
      // [^)] gives up at the first ) — fine since paths don't contain ) before the auth chain.
      expect(matches.length).toBe(8);
    });

    test('wardrobeLibrary.js — POST /analyze-image wraps requireAuth + aiRateLimiter', () => {
      expect(readSrc('wardrobeLibrary.js')).toMatch(
        /router\.post\(['"]\/analyze-image['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
    });

    test('wardrobeBrands.js — POST /generate-coverage wraps requireAuth + aiRateLimiter', () => {
      expect(readSrc('wardrobeBrands.js')).toMatch(
        /router\.post\(['"]\/generate-coverage['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
    });

    test('hairLibraryRoutes.js — POST /generate wraps requireAuth + aiRateLimiter', () => {
      expect(readSrc('hairLibraryRoutes.js')).toMatch(
        /router\.post\(['"]\/generate['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
    });

    test('makeupLibraryRoutes.js — POST /generate wraps requireAuth + aiRateLimiter', () => {
      expect(readSrc('makeupLibraryRoutes.js')).toMatch(
        /router\.post\(['"]\/generate['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
    });

    test('CP5 zone aggregate: 12 router.post lines wrap requireAuth + aiRateLimiter', () => {
      let total = 0;
      for (const f of CP5_FILES) {
        const src = readSrc(f);
        const matches = src.match(/router\.post\([^)]*requireAuth,\s*aiRateLimiter,/g) || [];
        total += matches.length;
      }
      expect(total).toBe(12);
    });
  });

  describe('Direct destructuring imports (post-WP1 lazy-noop removal)', () => {
    CP5_FILES.forEach((f) => {
      test(`${f} imports requireAuth via destructuring`, () => {
        const src = readSrc(f);
        expect(src).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
      });
    });
  });

  describe('CP5 zone aggregate consumer counts', () => {
    test('CP5 zone contains 93 total requireAuth references (7 imports + 86 handlers)', () => {
      const total = CP5_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        return sum + ((src.match(/\brequireAuth\b/g) || []).length);
      }, 0);
      expect(total).toBe(93);
    });

    test('CP5 zone contains 22 total aiRateLimiter references (5 files × 2 import-line matches + 12 handler invocations)', () => {
      const total = CP5_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        return sum + ((src.match(/\baiRateLimiter\b/g) || []).length);
      }, 0);
      expect(total).toBe(22);
    });

    test('CP5 zone has zero optionalAuth references', () => {
      const total = CP5_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        return sum + ((src.match(/\boptionalAuth\b/g) || []).length);
      }, 0);
      expect(total).toBe(0);
    });

    test('F-AUTH-3 baseline preserved: degradeOnInfraFailure consumer count unchanged from CP4', () => {
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
