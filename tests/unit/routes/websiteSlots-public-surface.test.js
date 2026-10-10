// ============================================================================
// Website slots: the public surface stays one GET (Task #2821)
// ============================================================================
// A static diff-lock in the F-AUTH-1 tier-test style
// (docs/reads/2026-10-10-website-content-read.md §1, §5):
//   - publicSite.js holds exactly one route, a GET, with a // PUBLIC: marker,
//     no write verb, no auth middleware and no req.user;
//   - websiteSlots.js puts requireAuth + authorize(['ADMIN']) on every route;
//   - app.js mounts each on its own path.

const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', '..', rel), 'utf8');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('publicSite.js: one public GET and nothing else', () => {
  const src = read('src/routes/publicSite.js');
  const code = strip(src);

  test('exactly one route, a GET on /site-content', () => {
    const routes = code.match(/router\.(get|post|put|patch|delete|all|use)\(/g) || [];
    expect(routes).toEqual(['router.get(']);
    expect(code).toMatch(/router\.get\('\/site-content', siteContentLimiter, async/);
  });

  test('carries the // PUBLIC: marker and reads no identity', () => {
    expect(src).toMatch(/\/\/ PUBLIC: the landing page's published media slots/);
    expect(code).not.toMatch(/req\.user|requireAuth|optionalAuth|authorize/);
  });

  test('sets cache headers and serves only publicContent', () => {
    expect(code).toMatch(/Cache-Control', 'public, max-age=300, stale-while-revalidate=3600'/);
    expect(code).toMatch(/publicContent\(models\)/);
  });
});

describe('websiteSlots.js: every route is admin-only', () => {
  const code = strip(read('src/routes/websiteSlots.js'));
  const routes = code.match(/router\.(get|post|put|patch|delete)\('[^']*', [^\n]*/g) || [];

  test('nine routes, each behind ...admin = [requireAuth, authorize([\'ADMIN\'])]', () => {
    expect(code).toMatch(/const admin = \[requireAuth, authorize\(\['ADMIN'\]\)\];/);
    expect(routes).toHaveLength(9);
    for (const r of routes) expect({ r, admin: /, \.\.\.admin, / .test(r) }).toEqual({ r, admin: true });
    expect(code).not.toMatch(/optionalAuth/);
  });
});

describe('app.js mounts each on its own path', () => {
  const app = read('src/app.js');
  test('the admin routes and the public read', () => {
    expect(app).toMatch(/app\.use\('\/api\/v1\/website-slots', websiteSlotRoutes\);/);
    expect(app).toMatch(/app\.use\('\/api\/v1\/public', publicSiteRoutes\);/);
    expect((app.match(/publicSiteRoutes/g) || []).length).toBe(2);
  });
});
