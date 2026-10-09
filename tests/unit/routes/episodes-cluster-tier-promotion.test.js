// ============================================================================
// UNIT TESTS — Episodes cluster Tier 1/Tier 2 promotion (Step 3 CP2)
// ============================================================================
// Tests for the 22-file Episodes cluster sweep (CP2 WP1+WP2+WP3 +
// associated test scaffolding):
//   - WP1: lazy-noop fallback removed from 4 files
//     (scriptParse, todoListRoutes, onboarding, lala-scene-detection)
//   - WP2: ~220 handlers promoted to Tier 1 (requireAuth)
//   - WP3: 5 admin handlers promoted to Tier 2 (requireAuth + authorize(['ADMIN']))
//     (4 wardrobeApproval + 1 uiOverlayRoutes /:showId/debug)
//   - 1 handler promoted to Tier 1 + aiRateLimiter
//     (episodeOrchestrationRoute /generate-episode-orchestration, D3 lock)
//
// Plus structural assertions:
//   - episodes.js commented-out auth (lines 400 + 473) eliminated
//   - episodes.js obsolete weakening comment block removed (line 307-312)
//   - authenticateToken / optionalAuth eliminated from CP2 zone
//
// Decisions locked in CP2 surface:
//   D1: wardrobeApproval all 4 handlers → Tier 2 admin
//   D2: uiOverlayRoutes /:showId/debug → Tier 2 admin
//   D3: episodeOrchestrationRoute → Tier 1 + aiRateLimiter
//   D4: shows.js full Tier 1 sweep (18 handlers, no partial)
//   D5: episodes.js line 307 obsolete comment removed; lines 313-317 + 372-376
//       promoted; lines 400 + 473 uncommented + upgraded
//   D6: phonePlaythroughRoutes authenticate → requireAuth (unified contract)

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', '..', '..', 'src', 'routes');
const readSrc = (name) => fs.readFileSync(path.join(ROUTES_DIR, name), 'utf8');

const CP2_FILES = [
  'episodes.js',
  'episodeBriefRoutes.js',
  'episodeOrchestrationRoute.js',
  'episodeScriptWriterRoutes.js',
  'gameShows.js',
  'iconCues.js',
  'cursorPaths.js',
  'musicCues.js',
  'productionPackage.js',
  'lalaScripts.js',
  'scriptParse.js',
  'timelineData.js',
  'wardrobeApproval.js',
  'phonePlaythroughRoutes.js',
  'phoneAIRoutes.js',
  'phoneMissionRoutes.js',
  'sceneStudioEpisodeRoutes.js',
  'onboarding.js',
  'shows.js',
  'uiOverlayRoutes.js',
  'todoListRoutes.js',
  'lala-scene-detection.js',
];

// Per-file requireAuth occurrence counts captured at CP2 close.
// Format: filename → count of `\brequireAuth\b` matches in file source.
const REQUIRE_AUTH_COUNTS = {
  // 78 at CP2 close; +1 for GET /:id/events (Task #1906, requireAuth);
  // +3 for GET /:id/title-card, POST /:id/title/approve, POST /:id/title-card
  // (Task #2386, requireAuth); +3 for GET /:id/task-list-overlay,
  // POST /:id/task-list/approve, POST /:id/task-list-overlay (Task #2395, requireAuth);
  // +3 for GET /:id/title-overlay/variants, POST /:id/title-overlay,
  // POST /:id/title-overlay/flourish (P11 amendment, Task #2395, requireAuth);
  // +1 for GET /:id/overlays (P15, requireAuth);
  // +2 for GET and PUT /:episodeId/locations (L6, §8(hh), requireAuth);
  // +2 for GET /:episodeId/removed-sets and POST /:episodeId/move-removed-sets (D2, §8(hh), requireAuth);
  // -3: the task-list overlay routes (Task #2395) retired (Evoni, 2026-10-07);
  // +1 for PUT /:id/script-locks (locked script beats, 2026-10-08, requireAuth).
  'episodes.js': 93,
  // 12 at CP2 close; +1 for POST /:episodeId/feed-moments/retry (Task #2220, requireAuth);
  // +3 for POST /:episodeId/dressed-angles/:angleId/{brief,generate,upload} (L10, §8(hh), requireAuth).
  // +1 for GET /:episodeId/dressed-angles (S8, §8(dd), requireAuth).
  // +1 for GET /:episodeId/production-coverage (§8(o) item 2, episode creation step 8, requireAuth).
  // +3 for GET, PUT /:episodeId/performance-clips and DELETE .../:clipId (the clip home, requireAuth).
  // +1 for POST /:episodeId/setup/resume (audit STATE-01, requireAuth).
  // +1 for POST /:episodeId/regenerate-beat (one script beat, Task #2785, requireAuth).
  'episodeBriefRoutes.js': 23,
  'episodeOrchestrationRoute.js': 2,
  'episodeScriptWriterRoutes.js': 8,
  'gameShows.js': 7,
  'iconCues.js': 16,
  'cursorPaths.js': 12,
  'musicCues.js': 10,
  'productionPackage.js': 7,
  'lalaScripts.js': 2,
  'scriptParse.js': 4,
  'timelineData.js': 3,
  'wardrobeApproval.js': 5,
  'phonePlaythroughRoutes.js': 7,
  'phoneAIRoutes.js': 3,
  'phoneMissionRoutes.js': 5,
  'sceneStudioEpisodeRoutes.js': 6,
  'onboarding.js': 6,
  // 19; +2 for GET and PUT /:id/lala-home (D13 travel, Task #2395, requireAuth);
  // +2 for GET and PUT /:id/scene-defaults (L3, §8(hh), requireAuth).
  'shows.js': 23,
  // 25 at CP2 close; +1 for PUT /:showId/phone-skin (Task #1964, requireAuth);
  // +1 for GET /:showId/usage (the show's Overlays library, 2026-10-07, requireAuth).
  'uiOverlayRoutes.js': 27,
  'todoListRoutes.js': 10,
  'lala-scene-detection.js': 4,
};

describe('Step 3 CP2 — Episodes cluster tier promotion', () => {
  describe('Per-file requireAuth consumer counts', () => {
    Object.entries(REQUIRE_AUTH_COUNTS).forEach(([filename, expected]) => {
      test(`${filename} contains exactly ${expected} requireAuth references`, () => {
        const src = readSrc(filename);
        const matches = src.match(/\brequireAuth\b/g) || [];
        expect(matches.length).toBe(expected);
      });
    });
  });

  describe('authenticateToken eliminated from CP2 zone', () => {
    CP2_FILES.forEach((filename) => {
      test(`${filename} has no active authenticateToken references`, () => {
        const src = readSrc(filename);
        // Strip line-comments, then assert no remaining authenticateToken refs.
        const stripped = src
          .split('\n')
          .filter((line) => !/^\s*\/\//.test(line))
          .join('\n');
        expect(stripped).not.toMatch(/\bauthenticateToken\b/);
      });
    });
  });

  describe('optionalAuth eliminated from CP2 zone', () => {
    CP2_FILES.forEach((filename) => {
      test(`${filename} has no optionalAuth references`, () => {
        const src = readSrc(filename);
        // F-AUTH-3 Tier 3 handlers (degradeOnInfraFailure factory) live in
        // press.js + manuscript-export.js — outside CP2 zone — so we can
        // safely assert zero optionalAuth in every CP2 file.
        expect(src).not.toMatch(/\boptionalAuth\b/);
      });
    });
  });

  describe('Lazy-noop fallback removed (WP1)', () => {
    const WP1_FILES = [
      'scriptParse.js',
      'todoListRoutes.js',
      'onboarding.js',
      'lala-scene-detection.js',
    ];
    WP1_FILES.forEach((filename) => {
      test(`${filename} has no lazy-noop ((req, res, next) => next()) fallback`, () => {
        const src = readSrc(filename);
        expect(src).not.toMatch(/\(\(req,\s*res,\s*next\)\s*=>\s*next\(\)\)/);
        expect(src).not.toMatch(/\(\(q,\s*r,\s*n\)\s*=>\s*n\(\)\)/);
      });

      test(`${filename} uses direct destructuring import for requireAuth`, () => {
        const src = readSrc(filename);
        expect(src).toMatch(
          /const\s*\{[^}]*\brequireAuth\b[^}]*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
        );
      });

      test(`${filename} no longer contains try/catch require pattern for auth import`, () => {
        const src = readSrc(filename);
        expect(src).not.toMatch(
          /try\s*\{[^}]*require\(['"]\.\.\/middleware\/auth['"]\)[\s\S]{0,200}\}\s*catch/,
        );
      });
    });
  });

  describe('episodes.js commented-out auth and obsolete comment removed (D5)', () => {
    let episodesSrc;
    beforeAll(() => {
      episodesSrc = readSrc('episodes.js');
    });

    test('no `// ✅ COMMENTED OUT FOR TESTING` markers remain', () => {
      expect(episodesSrc).not.toMatch(/COMMENTED OUT FOR TESTING/);
    });

    test('no `// authenticateToken,` commented-out auth remains', () => {
      expect(episodesSrc).not.toMatch(/\/\/\s*authenticateToken\s*,/);
    });

    test('obsolete weakening comment block ("tolerates a missing token") removed', () => {
      expect(episodesSrc).not.toMatch(/tolerates a missing token/);
      expect(episodesSrc).not.toMatch(/every other write path tolerates/);
    });

    test('PUT /:id (UPDATE EPISODE) uses requireAuth', () => {
      expect(episodesSrc).toMatch(
        /router\.put\(\s*['"]\/:id['"],\s*requireAuth,\s*asyncHandler\(episodeController\.updateEpisode\)/,
      );
    });

    test('DELETE /:id uses requireAuth', () => {
      expect(episodesSrc).toMatch(
        /router\.delete\(\s*['"]\/:id['"],\s*requireAuth,\s*asyncHandler\(episodeController\.deleteEpisode\)/,
      );
    });

    test('PUT /:episodeId/scenes/reorder uses requireAuth (line 400 uncommented)', () => {
      expect(episodesSrc).toMatch(
        /router\.put\(\s*['"]\/:episodeId\/scenes\/reorder['"],\s*validateUUIDParam\('episodeId'\),\s*requireAuth,/,
      );
    });

    test('POST /:episodeId/scripts uses requireAuth (line 473 uncommented)', () => {
      expect(episodesSrc).toMatch(
        /router\.post\(\s*['"]\/:episodeId\/scripts['"],\s*validateUUIDParam\('episodeId'\),\s*requireAuth,/,
      );
    });

    test('AI generators preserve requireAuth + aiRateLimiter pattern', () => {
      expect(episodesSrc).toMatch(
        /router\.post\(['"]\/:id\/generate-beats['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
      expect(episodesSrc).toMatch(
        /requireAuth,\s*aiRateLimiter,\s*validateUUIDParam\('episodeId'\),\s*asyncHandler/,
      );
    });
  });

  describe('Tier 2 admin carve-outs (WP3)', () => {
    test('wardrobeApproval.js — all 4 handlers wrapped with requireAuth + authorize([\'ADMIN\']) (D1)', () => {
      const src = readSrc('wardrobeApproval.js');
      expect(src).toMatch(
        /const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
      // Each of the 4 handlers should have requireAuth, authorize(['ADMIN']).
      const adminMatches = src.match(/requireAuth,\s*authorize\(\['ADMIN'\]\),/g) || [];
      expect(adminMatches.length).toBe(4);
    });

    test('uiOverlayRoutes.js — GET /:showId/debug wrapped with admin authorize (D2)', () => {
      const src = readSrc('uiOverlayRoutes.js');
      expect(src).toMatch(
        /router\.get\(\s*['"]\/:showId\/debug['"],\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/,
      );
    });
  });

  describe('Tier 1 + aiRateLimiter (D3)', () => {
    test('episodeOrchestrationRoute.js — POST /generate-episode-orchestration uses requireAuth + aiRateLimiter', () => {
      const src = readSrc('episodeOrchestrationRoute.js');
      expect(src).toMatch(
        /const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/,
      );
      expect(src).toMatch(
        /const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/,
      );
      expect(src).toMatch(
        /router\.post\(['"]\/generate-episode-orchestration['"],\s*requireAuth,\s*aiRateLimiter,/,
      );
    });
  });

  describe('CP2 aggregate consumer counts', () => {
    // 250 at CP2 close; +1 for episodes.js GET /:id/events (Task #1906);
    // +1 for uiOverlayRoutes.js PUT /:showId/phone-skin (Task #1964);
    // +1 for episodeBriefRoutes.js POST /:episodeId/feed-moments/retry (Task #2220);
    // +3 for episodes.js title approval + title card routes (Task #2386);
    // +3 for episodes.js task list approval + task-list overlay routes (Task #2395);
    // +2 for shows.js GET and PUT /:id/lala-home (D13 travel, Task #2395);
    // +3 for episodes.js title overlay routes (P11 amendment, Task #2395);
    // +1 for episodes.js GET /:id/overlays (P15);
    // +2 for episodes.js GET and PUT /:episodeId/locations (L6, §8(hh));
    // +2 for shows.js GET and PUT /:id/scene-defaults (L3, §8(hh));
    // +3 for episodeBriefRoutes.js dressed-angle brief, generate, upload (L10, §8(hh));
    // +2 for episodes.js removed-sets and move-removed-sets (D2, §8(hh));
    // +1 for episodeBriefRoutes.js GET dressed-angles (S8, §8(dd));
    // +1 for episodeBriefRoutes.js GET production-coverage (§8(o) item 2,
    // episode creation step 8);
    // +3 for episodeBriefRoutes.js performance-clips GET, PUT and DELETE
    // (the clip home agreed with step 8);
    // +1 for uiOverlayRoutes.js GET /:showId/usage (the show's Overlays library);
    // -3 for episodes.js task-list overlay routes, retired (Evoni, 2026-10-07);
    // +1 for episodes.js PUT /:id/script-locks (locked script beats, 2026-10-08).
    test('CP2 zone contains 283 total requireAuth references across 22 files', () => {
      const total = CP2_FILES.reduce((sum, filename) => {
        const src = readSrc(filename);
        const matches = src.match(/\brequireAuth\b/g) || [];
        return sum + matches.length;
      }, 0);
    // +1 for episodeBriefRoutes.js POST /:episodeId/setup/resume (audit STATE-01).
    // +1 for phonePlaythroughRoutes.js PUT /screen (Lala's Phone resume, 2026-10-07).
    // +2 for episodes.js PUT /:id/title-overlay/words and DELETE /:id/title-overlay (2026-10-07).
    // +1 for episodeBriefRoutes.js POST /:episodeId/regenerate-beat (Task #2785).
      expect(total).toBe(283);
    });

    test('F-AUTH-3 Tier 3 consumer count unchanged from CP1 (5 in src/routes/)', () => {
      // CP2 introduces no Tier 3 handlers; press.js + manuscript-export.js
      // remain the only Tier 3 consumers.
      const pressSrc = readSrc('press.js');
      const manuscriptSrc = readSrc('manuscript-export.js');
      const pattern = /degradeOnInfraFailure:\s*true/g;
      const pressCount = (pressSrc.match(pattern) || []).length;
      const manuscriptCount = (manuscriptSrc.match(pattern) || []).length;
      expect(pressCount).toBe(2);
      expect(manuscriptCount).toBe(3);
      expect(pressCount + manuscriptCount).toBe(5);
    });
  });
});
