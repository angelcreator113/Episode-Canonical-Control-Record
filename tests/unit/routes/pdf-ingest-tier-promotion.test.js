// ============================================================================
// UNIT TESTS — pdfIngestRoute.js (Step 3 CP7 — PROMOTE, AI POST + multipart)
// ============================================================================
// 1 handler (multi-line signature): POST /ingest-pdf — Tier 1 + aiRateLimiter
// + multer upload.single('file').

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'pdfIngestRoute.js'), 'utf8');

describe('Step 3 CP7 — pdfIngestRoute.js PROMOTE shape (multipart AI POST)', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('POST /ingest-pdf → requireAuth + aiRateLimiter + upload.single (multi-line)', () => {
    // Multi-line signature: requireAuth before multer, aiRateLimiter between
    expect(SRC).toMatch(/router\.post\(\s*\n?\s*'\/ingest-pdf',\s*\n?\s*requireAuth,\s*\n?\s*aiRateLimiter,\s*\n?\s*upload\.single\('file'\),/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
