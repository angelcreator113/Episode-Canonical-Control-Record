// ============================================================================
// Deploy runs 80-81 (2026-10-12): the on-box vite build hung until the SSM
// document's 1800 s ran out (status TimedOut), with no word of why. The
// deploy phase now stops first if another vite build is still running,
// prints the box's memory, and ends a build that runs past BUILD_TIMEOUT_S
// itself.
// ============================================================================
// As in workflowDeployHeapCarry.test.js, the script is never run whole: its
// functions are cut out and run in bash against stub commands in a throwaway
// directory. No host, AWS, database or network is touched.
// ============================================================================

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const SCRIPT_TEXT = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy', 'workflow-deploy.sh'), 'utf8');
const HEAD = 'd0850184fe3629da9957a6bb7a57d35b831592d3';

function fn(name) {
  const m = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n`, 'm').exec(SCRIPT_TEXT);
  if (!m) throw new Error(`${name}() not found`);
  return m[0];
}

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-timeout-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const FREE = `#!/usr/bin/env bash
echo '               total        used        free      shared  buff/cache   available'
echo 'Mem:            1910        1702          61           2         146          58'
echo 'Swap:              0           0           0'
`;

/** Writes stub commands into tmp/bin; returns that directory. */
function stubs(files) {
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(bin, name), text, { mode: 0o755 });
  return bin;
}

test('BUILD_TIMEOUT_S leaves room inside the SSM document\'s 1800 s for the backup and the fast-forward', () => {
  const m = /^BUILD_TIMEOUT_S=(\d+)$/m.exec(SCRIPT_TEXT);
  expect(m).not.toBeNull();
  expect(Number(m[1])).toBeGreaterThanOrEqual(600);
  expect(Number(m[1]) + 30).toBeLessThanOrEqual(1800 - 300);
});

test('memory_lines prints total and available memory, and swap, one line each', () => {
  const bin = stubs({ free: FREE });
  const res = spawnSync('bash', ['-c', `set -euo pipefail\n${fn('memory_lines')}\nmemory_lines`], {
    env: { PATH: `${bin}:/usr/bin:/bin` }, encoding: 'utf8',
  });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe('Memory: 1910 MB total, 58 MB available\nSwap: 0 MB total, 0 MB used\n');
});

test('memory_lines prints nothing and never fails when free is missing', () => {
  const res = spawnSync('bash', ['-c', `set -euo pipefail\n${fn('memory_lines')}\nFREE_CMD=no-such-command memory_lines; echo done`], {
    env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8',
  });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe('done\n');
});

describe('phase_deploy, against stub git, pgrep, timeout and npx', () => {
  // git: a clean tree already at the target, so the phase goes straight to the build.
  const GIT = `#!/usr/bin/env bash
case "$1" in
  status) exit 0 ;;
  rev-parse) echo "${HEAD}" ;;
  *) echo "unexpected git $*" >&2; exit 97 ;;
esac
`;
  // timeout: records its arguments, then exits as STUB_TIMEOUT says (124 is GNU timeout's "timed out").
  const TIMEOUT = `#!/usr/bin/env bash
echo "timeout $*" >>"$HOME/calls"
if [ -n "\${STUB_TIMEOUT:-}" ]; then echo 'transforming (2817) src/pages/WorldAdmin.jsx'; exit "$STUB_TIMEOUT"; fi
shift 3; exec "$@"
`;
  const NPX = `#!/usr/bin/env bash
echo "npx $* heap=$NODE_OPTIONS" >>"$HOME/calls"
if [ "\${STUB_BUILD:-ok}" = "fail" ]; then echo 'FATAL ERROR: Reached heap limit'; exit 134; fi
echo '✓ built in 3m 41s'
`;
  const PGREP = `#!/usr/bin/env bash
if [ -n "\${STUB_STALE:-}" ]; then printf '%s\\n' $STUB_STALE; exit 0; fi
exit 1
`;

  const deploy = (env = {}) => {
    const bin = stubs({ git: GIT, timeout: TIMEOUT, npx: NPX, pgrep: PGREP, free: FREE });
    const app = path.join(tmp, 'app');
    fs.mkdirSync(path.join(app, 'frontend'), { recursive: true });
    const res = spawnSync('bash', ['-c', [
      'set -euo pipefail',
      ['die', 'redact', 'require_clean_tree', 'build_heap_mb', 'running_vite_builds', 'memory_lines', 'phase_deploy'].map(fn).join('\n'),
      `PHASE=deploy; TARGET=${HEAD}; BUILD_TIMEOUT_S=1200; MEMINFO=/nonexistent; ARTIFACT_URL=none; ARTIFACT_SHA256=none`,
      `cd "${app}"`,
      'phase_deploy',
    ].join('\n')], { env: { PATH: `${bin}:/usr/bin:/bin`, HOME: tmp, ...env }, encoding: 'utf8' });
    const calls = fs.existsSync(path.join(tmp, 'calls')) ? fs.readFileSync(path.join(tmp, 'calls'), 'utf8') : '';
    return { status: res.status, out: res.stdout, err: res.stderr, calls };
  };

  test('a healthy build runs under timeout with the heap, prints the memory first, and finishes', () => {
    const res = deploy();
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    expect(res.calls).toContain('timeout -k 30 1200 npx vite build');
    expect(res.calls).toContain('npx vite build heap=--max-old-space-size=1536');
    expect(res.out.indexOf('Memory: 1910 MB total, 58 MB available')).toBeLessThan(res.out.indexOf('vite build with a 1536 MB heap, for at most 1200 s.'));
    expect(res.out.trim().split('\n').pop()).toBe('DEPLOY_OK=1');
  });

  test.each([[124], [137]])('a build stopped by the timeout (exit %i) says so, with its last lines and the memory', (code) => {
    const res = deploy({ STUB_TIMEOUT: String(code) });
    expect(res.status).toBe(1);
    expect(res.out).not.toMatch(/DEPLOY_OK/);
    expect(res.out).toContain('transforming (2817) src/pages/WorldAdmin.jsx');
    expect(res.out.match(/^Memory: /gm)).toHaveLength(2);
    expect(res.err).toMatch(/STOPPED \(deploy\): the vite build ran past 1200 s and was stopped/);
  });

  test('a build that fails on its own is still reported as failed, not as timed out', () => {
    const res = deploy({ STUB_BUILD: 'fail' });
    expect(res.status).toBe(1);
    expect(res.out).toContain('FATAL ERROR: Reached heap limit');
    expect(res.err).toMatch(/STOPPED \(deploy\): the vite build failed \(last lines above\)\./);
    expect(res.err).not.toMatch(/ran past/);
  });

  test('a vite build still running stops the phase before anything changes', () => {
    const res = deploy({ STUB_STALE: '4211 4230' });
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/STOPPED \(deploy\): a vite build is still running on the box \(pid 4211 4230\)\./);
    expect(res.err).toMatch(/Nothing was changed\./);
    expect(res.calls).toBe('');
    expect(res.out).not.toMatch(/DEPLOY_BACKUP|Fast-forwarded|vite build with/);
  });

  test('the leftover check comes before the backup and the fast-forward', () => {
    const phase = fn('phase_deploy');
    expect(phase.indexOf('running_vite_builds')).toBeLessThan(phase.indexOf('cp -a frontend/dist'));
    expect(phase.indexOf('running_vite_builds')).toBeLessThan(phase.indexOf('git merge --ff-only'));
  });
});
