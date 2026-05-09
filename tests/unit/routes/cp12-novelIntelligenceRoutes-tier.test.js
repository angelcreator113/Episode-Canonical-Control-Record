// CP12 — novelIntelligenceRoutes.js — Tier 1 sweep + 2 AI POST overlay
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'novelIntelligenceRoutes.js'), 'utf8');

describe('CP12 — novelIntelligenceRoutes.js Tier 1 + AI overlay', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('AI POST /signal carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/signal', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /manuscript/cascade carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/manuscript\/cascade', requireAuth, aiRateLimiter,/);
  });
  test('non-AI POST /voice-rules/:id/confirm carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/voice-rules\/:id\/confirm', requireAuth,/);
  });
});
