// ============================================================================
// D-21 (Evoni, 2026-11-06): a Deploy run is pinned to the exact commit the
// person starting it expected. Read as YAML: nothing is run, no host touched.
// ============================================================================
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..', '..', '..');
const TEXT = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
const WF = yaml.load(TEXT);
const names = (job) => WF.jobs[job].steps.map((s) => s.name || s.uses);
const step = (job, name) => WF.jobs[job].steps.find((s) => s.name === name);

describe('Deploy is pinned to an expected commit (D-21)', () => {
  test('the dispatch requires expected_sha; expected_prs is optional', () => {
    const inputs = WF.on.workflow_dispatch.inputs;
    expect(inputs.expected_sha).toMatchObject({ required: true, type: 'string' });
    expect(inputs.expected_prs).toMatchObject({ required: false, type: 'string' });
  });

  test('build: checkout (full history), then the pin check, then the release summary, before anything is built', () => {
    const n = names('build');
    expect(n.slice(0, 3)).toEqual(['Check out the commit', 'Check the pinned commit', 'Release summary (what this run will ship)']);
    expect(step('build', 'Check out the commit').with['fetch-depth']).toBe(0);
    expect(n.indexOf('Release summary (what this run will ship)')).toBeLessThan(n.indexOf('Install and build'));
  });

  test('build: inputs reach the shell only through env, never interpolated into a script', () => {
    const pin = step('build', 'Check the pinned commit');
    expect(pin.env.EXPECTED_SHA).toBe('${{ inputs.expected_sha }}');
    expect(pin.run).toBe('bash scripts/deploy/check-pin.sh pin "$EXPECTED_SHA" "$GITHUB_SHA"');
    const rel = step('build', 'Release summary (what this run will ship)');
    expect(rel.env.EXPECTED_PRS).toBe('${{ inputs.expected_prs }}');
    for (const s of WF.jobs.build.steps.concat(WF.jobs.deploy.steps)) {
      expect(String(s.run || '')).not.toMatch(/\$\{\{\s*inputs\./);
    }
  });

  test('build: the release summary base comes from the last successful Deploy run and is passed on', () => {
    const rel = step('build', 'Release summary (what this run will ship)');
    expect(rel.run).toMatch(/actions\/workflows\/deploy\.yml\/runs\?branch=main&status=success&per_page=1/);
    expect(rel.run).toMatch(/release-summary\.sh "\$base" "\$GITHUB_SHA" "\$EXPECTED_PRS"/);
    expect(WF.jobs.build.permissions).toMatchObject({ contents: 'read', actions: 'read' });
    expect(WF.jobs.build.outputs.base_sha).toBe('${{ steps.release.outputs.base_sha }}');
  });

  test('deploy: the pin check is the first step, before any credential or box action', () => {
    const n = names('deploy');
    expect(n[0]).toBe('Check the pinned commit');
    expect(n.indexOf('Check the pinned commit')).toBeLessThan(n.indexOf('Configure AWS credentials (OIDC)'));
    const pin = step('deploy', 'Check the pinned commit');
    expect(pin.env.EXPECTED_SHA).toBe('${{ inputs.expected_sha }}');
    expect(pin.run).toMatch(/"\$EXPECTED_SHA" != "\$GITHUB_SHA"/);
    expect(pin.run).toMatch(/"\$TARGET_SHA" != "\$GITHUB_SHA"/);
  });

  test('deploy: production must be at the summary base, checked after the read-only plan and before any snapshot', () => {
    const n = names('deploy');
    const at = n.indexOf("Check production is at the release summary's base");
    expect(at).toBe(n.indexOf('Plan (read-only, on the box)') + 1);
    expect(at).toBeLessThan(n.findIndex((x) => /Remove older deploy snapshots/.test(x)));
    expect(at).toBeLessThan(n.indexOf('Snapshot the database'));
    const s = step('deploy', "Check production is at the release summary's base");
    expect(s.env).toMatchObject({
      BOX_SHA: '${{ steps.plan.outputs.old_sha }}',
      BASE_SHA: '${{ needs.build.outputs.base_sha }}',
      RESUME: '${{ steps.plan.outputs.resume }}',
    });
  });

  test('one immutable commit for every stage: checkout ref, artifact name and TARGET_SHA all derive from github.sha', () => {
    expect(step('build', 'Check out the commit').with.ref).toBe('${{ github.sha }}');
    expect(step('build', 'Keep the pack for the deploy job').with.name).toBe('frontend-dist-${{ github.sha }}');
    expect(WF.jobs.deploy.env.TARGET_SHA).toBe('${{ github.sha }}');
    expect(step('deploy', 'Check out the deploy helpers').with.ref).toBe('${{ github.sha }}');
  });
});
