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
  // authorize joined the import on 2026-11-16: the greeting, a paid AI call on a read, is an ADMIN's (Evoni).
  test('requireAuth + authorize import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('speakLimiter preserved on POST /speak', () => {
    expect(SRC).toMatch(/router\.post\('\/speak',\s*requireAuth,\s*speakLimiter,/);
  });

  test('readStoryLimiter preserved on POST /read-story', () => {
    expect(SRC).toMatch(/router\.post\('\/read-story',\s*requireAuth,\s*readStoryLimiter,/);
  });

  // Q12 stands for the two routes it was about: /speak and /read-story keep their own limiter and are not
  // limited twice. The greeting had no limiter at all; since 2026-11-16 it carries aiRateLimiter and ADMIN.
  test('no aiRateLimiter on /speak or /read-story (Q12 — their own limiters are the AI-rate-limit equivalent)', () => {
    expect(SRC).not.toMatch(/router\.post\('\/speak'[^\n]*aiRateLimiter/);
    expect(SRC).not.toMatch(/router\.post\('\/read-story'[^\n]*aiRateLimiter/);
  });

  test('GET /greeting is an ADMIN\'s and rate limited: every read is a paid AI call', () => {
    expect(SRC).toMatch(/router\.get\('\/greeting',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*aiRateLimiter,/);
    // And on that one route only.
    expect(SRC.match(/,\s*aiRateLimiter,/g)).toHaveLength(1);
  });

  test('no optionalAuth references', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
