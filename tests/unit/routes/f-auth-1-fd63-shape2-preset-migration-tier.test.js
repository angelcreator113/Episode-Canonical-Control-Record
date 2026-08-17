// F-AUTH-1 FD-63 — Shape 2: preset middleware migration.
//
// These routers already had file-scope middleware, so the promotion is a
// router.use(requireAuth) substitution at the top of the file. The tests are
// source-only and keep the route count visible.
//
// Promoted at 8ba2b95c. Static source assertions; diff-lock only.
const fs = require('fs');
const path = require('path');

const read = (f) =>
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', f), 'utf8');

const SRC = {
  authorNoteRoutes: read('authorNoteRoutes.js'),
  entanglementRoutes: read('entanglementRoutes.js'),
};

describe('F-AUTH-1 FD-63 Shape 2 — preset migrations', () => {
  describe.each(Object.entries(SRC))('%s.js', (name, src) => {
    test('imports requireAuth from middleware/auth', () => {
      expect(src).toMatch(
        /const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/
      );
    });

    test('no optionalAuth survivors, including in comments', () => {
      expect(src).not.toMatch(/optionalAuth/);
    });

    test('has router.use(requireAuth) at file scope', () => {
      expect(src).toMatch(/router\.use\(requireAuth\)/);
    });
  });

  // The Shape 2 claim is that ONE file-scope mount covers every route in the
  // file — so the assertion counts router.use(requireAuth) sites, not raw
  // occurrences. A raw count would also pick up the import and any mention in
  // a comment (entanglementRoutes has one), which says nothing about coverage.
  test.each([
    ['authorNoteRoutes'],
    ['entanglementRoutes'],
  ])('%s.js carries exactly one requireAuth at file scope', (name) => {
    const mounts = SRC[name].match(/\.use\(\s*requireAuth\s*\)/g) || [];
    expect(mounts).toHaveLength(1);
  });

  // No route in these files re-states requireAuth inline: the preset is the
  // single source of coverage, and an inline repeat would mean the preset had
  // been narrowed.
  test.each([
    ['authorNoteRoutes'],
    ['entanglementRoutes'],
  ])('%s.js declares no route-level requireAuth alongside the preset', (name) => {
    const inline = SRC[name].match(/\.(get|post|put|patch|delete)\([^\n]*requireAuth/g) || [];
    expect(inline).toHaveLength(0);
  });

  test('Shape 2 still exists as a shape — the file-scope middleware substitution is visible', () => {
    Object.entries(SRC).forEach(([name, src]) => {
      expect(src).toMatch(/router\.use\(requireAuth\)/);
    });
  });
});