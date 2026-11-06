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
    // Only one trigger key at the top of `on:`. Since D-21 (2026-11-06) the
    // dispatch carries inputs (the pinned commit), so lines below it are its
    // inputs, indented under workflow_dispatch, never another trigger.
    const on = block('on');
    expect(on[0]).toBe('  workflow_dispatch:');
    expect(on.filter((l) => /^ {2}\S/.test(l))).toEqual(['  workflow_dispatch:']);
    expect(on.slice(1).every((l) => /^ {4}/.test(l))).toBe(true);
  });

  test('its job still runs only on main, only when DEPLOY_ENABLED, in the production environment', () => {
    const jobs = block('jobs');
    expect(jobs).toContain("    if: vars.DEPLOY_ENABLED == 'true' && github.ref == 'refs/heads/main'");
    expect(jobs).toContain('    environment: production');
  });
});
