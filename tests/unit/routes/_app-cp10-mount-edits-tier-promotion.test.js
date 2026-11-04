// ============================================================================
// UNIT TESTS — app.js mount-line edits (Step 3 CP10 — WP6 + WP8)
// ============================================================================
// app.js mount-line edits per §5.3 Items 7 + 8 locks:
//   - /api/v1/seed env-gated (Tier 5); since the debug/seed opt-in fix the gate
//     is ENABLE_SEED_ROUTES=true and never NODE_ENV=production
//     (src/utils/diagnosticRoutes.js), plus requireAuth + ADMIN at the mount
//   - /admin/queues mount carries requireAuth + authorize(['ADMIN']) (Tier 2 MOUNT LINE)

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'app.js'), 'utf8');

describe('Step 3 CP10 — app.js mount-line edits', () => {
  test('/api/v1/seed wrapped in the opt-in env gate (Tier 5 per Item 7)', () => {
    expect(SRC).toMatch(/const SEED_ROUTES_ENABLED = diagnosticRoutesEnabled\(['"]ENABLE_SEED_ROUTES['"]\)/);
    expect(SRC).toMatch(/if\s*\(\s*SEED_ROUTES_ENABLED\s*\)\s*\{[\s\S]{0,300}app\.use\(['"]\/api\/v1\/seed['"],\s*requireAuth,\s*authorize\(\['ADMIN'\]\)/);
  });

  test('/admin/queues mount-line auth (Tier 2 per Item 8 V6 admin-prefix)', () => {
    expect(SRC).toMatch(/app\.use\(['"]\/admin\/queues['"],\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*queueMonitorRoutes\)/);
  });
});
