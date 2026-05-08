// ============================================================================
// UNIT TESTS — memories cluster (Step 3 CP7 — 8 sub-files bundled per D4)
// ============================================================================
// 8 sub-router files under src/routes/memories/:
//   engine.js (23 handlers, 11 AI POSTs)
//   stories.js (9 handlers, 5 AI POSTs)
//   interview.js (9 handlers, 6 AI POSTs)
//   core.js (10 handlers, 4 AI POSTs)
//   planning.js (6 handlers, 3 AI POSTs)
//   extras.js (6 handlers, 2 AI POSTs)
//   assistant.js (5 handlers, 2 AI POSTs — preserves custom assistantLimiter alongside aiRateLimiter)
//   voice.js (4 handlers, 3 AI POSTs)
// All cumulative 72 handlers / ~36 AI POSTs / 8 lazy-noop residues removed.

const fs = require('fs');
const path = require('path');

const MEM_DIR = path.join(__dirname, '..', '..', '..', 'src', 'routes', 'memories');
const readSrc = (name) => fs.readFileSync(path.join(MEM_DIR, name), 'utf8');

const ALL_FILES = ['engine.js', 'stories.js', 'interview.js', 'core.js', 'planning.js', 'extras.js', 'assistant.js', 'voice.js'];

describe('Step 3 CP7 — memories cluster Tier 1 sweep + AI POST PROMOTE', () => {
  describe('Cluster-wide hygiene', () => {
    ALL_FILES.forEach((file) => {
      describe(`memories/${file}`, () => {
        const SRC = readSrc(file);

        test('imports requireAuth from middleware/auth', () => {
          expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/\.\.\/middleware\/auth['"]\)/);
        });

        test('imports aiRateLimiter', () => {
          expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/\.\.\/middleware\/aiRateLimiter['"]\)/);
        });

        test('lazy-noop fallback removed (no try/catch around require auth)', () => {
          expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try\s*\{[\s\S]{0,300}require\(['"]\.\.\/\.\.\/middleware\/auth['"]\)/);
        });

        test('no optionalAuth handler-references on writes', () => {
          const writeHandlers = SRC.match(/^router\.(post|put|patch|delete)\([^\n]+/gm) || [];
          writeHandlers.forEach((line) => expect(line).not.toMatch(/\boptionalAuth\b/));
        });
      });
    });
  });

  describe('engine.js — 11 AI POSTs PROMOTE shape', () => {
    const SRC = readSrc('engine.js');
    ['/generate-living-state', '/generate-character-arc', '/generate-relationship-web',
     '/generate-story-tasks', '/generate-story-tasks-stream', '/generate-next-chapter',
     '/generate-story', '/revise-story', '/check-story-consistency',
     '/extract-story-memories', '/story-engine-update-registry'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('stories.js — 5 AI POSTs PROMOTE shape', () => {
    const SRC = readSrc('stories.js');
    ['/voice-to-story', '/story-edit', '/story-continue', '/story-deepen', '/story-nudge'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('interview.js — 6 AI POSTs PROMOTE shape', () => {
    const SRC = readSrc('interview.js');
    ['/scene-interview', '/narrative-intelligence', '/continuity-check', '/rewrite-options',
     '/character-interview-next', '/character-interview-complete'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('core.js — 4 AI POSTs PROMOTE shape', () => {
    const SRC = readSrc('core.js');
    ['/structure-universe', '/lines/:lineId/extract', '/books/:bookId/extract-all', '/memories/:memoryId/dismiss'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('planning.js — 3 AI POSTs PROMOTE shape', () => {
    const SRC = readSrc('planning.js');
    ['/scene-planner', '/story-outline', '/story-planner-chat'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('extras.js — 2 AI POSTs PROMOTE shape', () => {
    const SRC = readSrc('extras.js');
    ['/generate-intimate-scene', '/ai/enhance-prompt'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('assistant.js — 2 AI POSTs PROMOTE shape (preserves custom assistantLimiter)', () => {
    const SRC = readSrc('assistant.js');
    ['/assistant-command', '/assistant-command-stream'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter + assistantLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*assistantLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('voice.js — 3 AI POSTs PROMOTE shape', () => {
    const SRC = readSrc('voice.js');
    ['/character-voice-session', '/generate-career-echo', '/generate-chapter-draft'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });
});
