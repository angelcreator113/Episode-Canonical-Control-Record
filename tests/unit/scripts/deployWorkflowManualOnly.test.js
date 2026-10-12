// ============================================================================
// The Deploy workflow runs only when Evoni starts it (2026-10-12).
// ============================================================================
// While every push to main queued a run, each merge cancelled the run still
// waiting for her approval (runs #82-#92 on 2026-10-12). The workflow now has
// one trigger, workflow_dispatch, and its job still runs only on main and only
// with DEPLOY_ENABLED. Read as text: nothing is run, no host is touched.
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const TEXT = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');

/** A top-level block's lines, comments and blank lines left out: from "key:" to the next top-level key. */
function block(key) {
  const lines = TEXT.split('\n');
  const start = lines.indexOf(`${key}:`);
  if (start === -1) throw new Error(`${key}: not found`);
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    if (line.trim() && !line.trim().startsWith('#')) out.push(line);
  }
  return out;
}

describe('the Deploy workflow is manual only', () => {
  test('its only trigger is Run workflow (workflow_dispatch); a push or merge queues nothing', () => {
    expect(block('on')).toEqual(['  workflow_dispatch:']);
  });

  test('its job still runs only on main, only when DEPLOY_ENABLED, in the production environment', () => {
    const jobs = block('jobs');
    expect(jobs).toContain("    if: vars.DEPLOY_ENABLED == 'true' && github.ref == 'refs/heads/main'");
    expect(jobs).toContain('    environment: production');
  });
});
