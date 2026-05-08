// ============================================================================
// UNIT TESTS — app.js mount-line edits (Step 3 CP10 — WP6 + WP8)
// ============================================================================
// app.js mount-line edits per §5.3 Items 7 + 8 locks:
//   - /api/v1/seed wrapped in NODE_ENV !== 'production' (Tier 5)
//   - /admin/queues mount carries requireAuth + authorize(['ADMIN']) (Tier 2 MOUNT LINE)

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'app.js'), 'utf8');

describe('Step 3 CP10 — app.js mount-line edits', () => {
  test('/api/v1/seed wrapped in NODE_ENV !== production check (Tier 5 per Item 7)', () => {
    expect(SRC).toMatch(/if\s*\(\s*process\.env\.NODE_ENV\s*!==\s*['"]production['"]\s*\)\s*\{[\s\S]{0,300}app\.use\(['"]\/api\/v1\/seed['"]/);
  });

  test('/admin/queues mount-line auth (Tier 2 per Item 8 V6 admin-prefix)', () => {
    expect(SRC).toMatch(/app\.use\(['"]\/admin\/queues['"],\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*queueMonitorRoutes\)/);
  });
});
