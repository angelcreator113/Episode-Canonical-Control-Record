// ============================================================================
// UNIT TESTS — manuscript-export.js: the memoir downloads need sign-in
// ============================================================================
// Step 3 CP9 (D12) made the three GETs public (optionalAuth with
// degradeOnInfraFailure). Evoni, 2026-10-15: anyone with the link must not be
// able to download the memoir without signing in. They take requireAuth.
//   - GET /book/:bookId/meta
//   - GET /book/:bookId/docx
//   - GET /book/:bookId/pdf

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'manuscript-export.js'), 'utf8');

describe('manuscript-export.js: sign-in required', () => {
  test('imports requireAuth, not optionalAuth', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).not.toMatch(/optionalAuth/);
  });

  test.each(['meta', 'docx', 'pdf'])('GET /book/:bookId/%s requires sign-in', (kind) => {
    expect(SRC).toMatch(new RegExp(`router\\.get\\('/book/:bookId/${kind}',\\s*requireAuth,\\s*async`));
  });

  test('no PUBLIC route is left', () => {
    expect(SRC).not.toMatch(/\/\/\s*PUBLIC:/);
  });

  test('no aiRateLimiter (no AI POSTs — manuscript export is rendering-only)', () => {
    expect(SRC).not.toMatch(/aiRateLimiter/);
  });
});
