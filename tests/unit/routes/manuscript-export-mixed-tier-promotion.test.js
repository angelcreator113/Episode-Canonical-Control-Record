// ============================================================================
// UNIT TESTS — manuscript-export.js (Step 3 CP9, D12 lock)
// ============================================================================
// 3 handlers — Tier 4 PUBLIC throughout with F-Auth-3 polymorphic factory
// preserved verbatim per D12 (9th cumulative §5.21 instance):
//   - GET /book/:bookId/meta — optionalAuth({ degradeOnInfraFailure: true })
//   - GET /book/:bookId/docx — optionalAuth({ degradeOnInfraFailure: true })
//   - GET /book/:bookId/pdf  — optionalAuth({ degradeOnInfraFailure: true })
// First Tier 4 disposition with explicit degrade flag preserved.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'manuscript-export.js'), 'utf8');

describe('Step 3 CP9 — manuscript-export.js Tier 4 PUBLIC + F-Auth-3 factory preserved', () => {
  test('imports optionalAuth (no requireAuth — pure Tier 4 file)', () => {
    expect(SRC).toMatch(/const\s*\{\s*optionalAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('comment block documents §5.21 9th cumulative instance + F-Auth-3 polymorphic factory preservation', () => {
    expect(SRC).toMatch(/§5\.21|mixed Tier 1\+4/);
    expect(SRC).toMatch(/9th cumulative instance/);
    expect(SRC).toMatch(/polymorphic factory/);
  });

  describe('Tier 4 PUBLIC GETs (3 manuscript-rendering endpoints — D12)', () => {
    test('GET /book/:bookId/meta uses optionalAuth({ degradeOnInfraFailure: true })', () => {
      expect(SRC).toMatch(/router\.get\('\/book\/:bookId\/meta',\s*optionalAuth\(\s*\{\s*degradeOnInfraFailure:\s*true\s*\}\s*\),\s*async/);
    });
    test('GET /book/:bookId/docx uses optionalAuth({ degradeOnInfraFailure: true })', () => {
      expect(SRC).toMatch(/router\.get\('\/book\/:bookId\/docx',\s*optionalAuth\(\s*\{\s*degradeOnInfraFailure:\s*true\s*\}\s*\),\s*async/);
    });
    test('GET /book/:bookId/pdf uses optionalAuth({ degradeOnInfraFailure: true })', () => {
      expect(SRC).toMatch(/router\.get\('\/book\/:bookId\/pdf',\s*optionalAuth\(\s*\{\s*degradeOnInfraFailure:\s*true\s*\}\s*\),\s*async/);
    });
  });

  test('no requireAuth references (Tier 4 PUBLIC throughout per D12)', () => {
    expect(SRC).not.toMatch(/\brequireAuth\b/);
  });

  test('no aiRateLimiter (no AI POSTs — manuscript export is rendering-only)', () => {
    expect(SRC).not.toMatch(/\baiRateLimiter\b/);
  });
});
