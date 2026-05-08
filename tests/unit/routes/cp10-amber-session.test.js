// ============================================================================
// UNIT TESTS — amberSessionRoutes.js (Step 3 CP10 — WP3 + WP7 — 4 Tier 1; speakLimiter + readStoryLimiter preserved per Q12 (AI-rate-limit equivalents))
// ============================================================================
// 4 handlers all Tier 1 (replaced optionalAuth). Custom speakLimiter +
// readStoryLimiter preserved per Q12 lock (AI-rate-limit equivalents; no
// double rate-limit via aiRateLimiter).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'amberSessionRoutes.js'), 'utf8');

describe('Step 3 CP10 — amberSessionRoutes.js', () => {
  test('requireAuth import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('speakLimiter preserved on POST /speak', () => {
    expect(SRC).toMatch(/router\.post\('\/speak',\s*requireAuth,\s*speakLimiter,/);
  });

  test('readStoryLimiter preserved on POST /read-story', () => {
    expect(SRC).toMatch(/router\.post\('\/read-story',\s*requireAuth,\s*readStoryLimiter,/);
  });

  test('no aiRateLimiter (Q12 — speakLimiter is AI-rate-limit equivalent)', () => {
    expect(SRC).not.toMatch(/aiRateLimiter/);
  });

  test('no optionalAuth references', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
