// ============================================================================
// UNIT TESTS — files.js (Step 3 CP10 — WP2 — 5 legacy authenticateToken → requireAuth + multer/uploadValidation preserved)
// ============================================================================
// 5 handlers all Tier 1; multer (upload.single) + uploadValidation preserved per §5.55.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'files.js'), 'utf8');

describe('Step 3 CP10 — files.js', () => {
  test('requireAuth import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('no authenticateToken legacy alias', () => {
    expect(SRC).not.toMatch(/\bauthenticateToken\b/);
  });

  test('uploadValidation preserved', () => {
    expect(SRC).toMatch(/uploadValidation/);
  });
});
