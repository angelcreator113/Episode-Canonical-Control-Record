// ============================================================================
// Task #2948 — the Deploy workflow's on-box script: the vite build heap, and
// carrying the migrations of a deploy that did not finish.
// ============================================================================
// The script itself is never run here (it refuses outside the box, and only
// the Deploy workflow runs it). These tests read it as text: the two new
// functions are cut out and run alone in bash against a throwaway HOME and a
// fake /proc/meminfo; the phases are checked for where they call them.
// No host, AWS, database or network is touched.
// ============================================================================

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const SCRIPT_TEXT = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy', 'workflow-deploy.sh'), 'utf8');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
const HEAD = 'd0850184fe3629da9957a6bb7a57d35b831592d3';
const OTHER = '09e49c1e3b8426825d1ca37ab94345885dc2e249';

/** A top-level bash function's text, from "name() {" to its closing "}" at column 0. */
function fn(name) {
  const m = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n`, 'm').exec(SCRIPT_TEXT);
  if (!m) throw new Error(`${name}() not found`);
  return m[0];
}

/** Runs `body` in bash after the named functions; returns { status, stdout }. */
function bash(body, env = {}, fns = []) {
  const res = spawnSync('bash', ['-c', `set -euo pipefail\n${fns.map(fn).join('\n')}\n${body}`], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout.trim(), stderr: res.stderr };
}

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-2948-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

test('the whole script parses (bash -n, nothing run)', () => {
  const res = spawnSync('bash', ['-n'], { input: SCRIPT_TEXT, encoding: 'utf8' });
  expect(res.stderr).toBe('');
  expect(res.status).toBe(0);
});

describe('build_heap_mb: about 60% of RAM, 1536 to 3072 MB', () => {
  const heapFor = (memTotalKb) => {
    const meminfo = path.join(tmp, 'meminfo');
    fs.writeFileSync(meminfo, memTotalKb === null ? 'MemFree: 1000 kB\n' : `MemTotal:       ${memTotalKb} kB\nMemFree: 1000 kB\n`);
    return bash('build_heap_mb', { MEMINFO: meminfo }, ['build_heap_mb']).stdout;
  };

  test.each([
    [1 * 1024 * 1024, '1536'], // 1 GB box: the floor
    [2 * 1024 * 1024, '1536'], // 2 GB: 60% is 1228, so the floor
    [4 * 1024 * 1024, '2457'], // 4 GB: 60%
    [8 * 1024 * 1024, '3072'], // 8 GB: the cap
  ])('%i kB of RAM gives %s MB', (kb, mb) => {
    expect(heapFor(kb)).toBe(mb);
  });

  test('unreadable meminfo falls back to the floor', () => {
    expect(heapFor(null)).toBe('1536');
    expect(bash('build_heap_mb', { MEMINFO: path.join(tmp, 'missing') }, ['build_heap_mb']).stdout).toBe('1536');
  });
});

describe('unfinished_deploy_of: only a workflow deploy that did not finish', () => {
  const run = () => bash(`DEPLOY_MARKER="$HOME/.episode-deploy-unfinished"\nunfinished_deploy_of ${HEAD}`, { HOME: tmp }, ['unfinished_deploy_of']);

  test('the marker naming this commit is evidence', () => {
    fs.writeFileSync(path.join(tmp, '.episode-deploy-unfinished'), `${OTHER} ${HEAD}\n`);
    const res = run();
    expect(res.status).toBe(0);
    expect(res.stdout).toBe(`the deploy marker names ${HEAD}`);
  });

  test('a marker for another commit means the tree was moved by hand since: no evidence, even with a backup', () => {
    fs.writeFileSync(path.join(tmp, '.episode-deploy-unfinished'), `${HEAD} ${OTHER}\n`);
    fs.mkdirSync(path.join(tmp, `dist-backup-20261011T214232Z-${HEAD.slice(0, 12)}`));
    expect(run().status).toBe(1);
  });

  test("with no marker (a box stuck before it existed), the deploy's own backup for this commit is evidence", () => {
    fs.mkdirSync(path.join(tmp, `dist-backup-20261011T214232Z-${HEAD.slice(0, 12)}`));
    const res = run();
    expect(res.status).toBe(0);
    expect(res.stdout).toBe(`the deploy's frontend backup ~/dist-backup-20261011T214232Z-${HEAD.slice(0, 12)}`);
  });

  test('no marker and no backup for this commit (only for others): no evidence', () => {
    fs.mkdirSync(path.join(tmp, `dist-backup-20261011T205530Z-${OTHER.slice(0, 12)}`));
    fs.writeFileSync(path.join(tmp, `dist-backup-20261011T214232Z-${HEAD.slice(0, 12)}`), 'a file, not the backup directory');
    expect(run().status).toBe(1);
  });
});

describe('the phases call them where they must', () => {
  const phase = (name) => fn(`phase_${name}`);

  test('plan carries pending files only on exit 1 with files listed and evidence; anything else still stops', () => {
    const plan = phase('plan');
    expect(plan).toMatch(/if \[ "\$PENDING_RC" -eq 1 \] && \[ -n "\$PENDING_FILES" \] && evidence="\$\(unfinished_deploy_of "\$old"\)"; then/);
    expect(plan).toMatch(/sed 's\/\^\/PLAN_CARRIED=\/'/);
    expect(plan).toMatch(/else\n\s+die "the pending-migration check on the current tree exited \$PENDING_RC, not 0\."/);
    // The carry comes after every other plan check, and before PLAN_OK.
    expect(plan.indexOf('package files change')).toBeLessThan(plan.indexOf('PLAN_CARRIED'));
    expect(plan.indexOf('an existing migration file is modified')).toBeLessThan(plan.indexOf('PLAN_CARRIED'));
    expect(plan.lastIndexOf('PLAN_OK=1')).toBeGreaterThan(plan.indexOf('PLAN_CARRIED'));
  });

  test('deploy marks the deploy unfinished right after the fast-forward, and builds with the explicit heap', () => {
    const deploy = phase('deploy');
    expect(deploy.indexOf('printf \'%s %s\\n\' "$head" "$TARGET" >"$DEPLOY_MARKER"')).toBeGreaterThan(deploy.indexOf('git merge --ff-only --quiet "$TARGET"'));
    expect(deploy).toMatch(/heap="\$\(build_heap_mb\)"/);
    expect(deploy).toMatch(/NODE_OPTIONS="--max-old-space-size=\$\{heap\}" npx vite build/);
    expect(deploy).not.toMatch(/\(cd frontend && npx vite build\)/);
  });

  test('only a successful restart clears the mark, just before RESTART_OK', () => {
    const restart = phase('restart');
    const clear = restart.indexOf('rm -f "$DEPLOY_MARKER"');
    expect(clear).toBeGreaterThan(restart.lastIndexOf('die '));
    expect(clear).toBeLessThan(restart.indexOf('RESTART_OK=1'));
    expect(phase('migrate')).not.toMatch(/DEPLOY_MARKER/);
  });

  test('pending_check lists the pending files in PENDING_FILES', () => {
    expect(fn('pending_check')).toMatch(/PENDING_FILES="\$\(printf '%s\\n' "\$out" \| grep -oE/);
  });

  test('the workflow collects the carried files and lists them in the summary', () => {
    expect(WORKFLOW).toMatch(/grep -E '\^PLAN_CARRIED=\[0-9A-Za-z\._-\]\+\\\.js\$' "\$OUT" \| cut -d= -f2- >"\$RUNNER_TEMP\/carried\.txt"/);
    expect(WORKFLOW).toMatch(/Carried from a deploy that did not finish/);
  });
});

describe('phase_plan end to end, against stub git and a stub ledger check', () => {
  const TARGET = 'f2b8564300000000000000000000000000000000';
  // git: a clean tree at HEAD, the target a fast-forward on origin/main, no
  // package change, two migrations added in the range.
  const GIT = `#!/usr/bin/env bash
case "$1" in
  status) exit 0 ;;
  fetch) exit 0 ;;
  merge-base) exit 0 ;;
  rev-parse) echo "${HEAD}" ;;
  rev-list) echo 9 ;;
  diff)
    case "$*" in
      *"--diff-filter=A"*) printf 'src/migrations/20261011220000-add-story-order-to-pulse-fits.js\\nsrc/migrations/20261011230000-create-pulse-reveals.js\\n' ;;
      *) exit 0 ;;
    esac ;;
  *) echo "unexpected git $*" >&2; exit 97 ;;
esac
`;
  // node: the pending-migration check, as the box printed it in run 69.
  const NODE = `#!/usr/bin/env bash
if [ "$STUB_LEDGER" = "2" ]; then echo '[pending-migrations] ERROR: could not read "SequelizeMeta": timeout'; exit 2; fi
echo '[pending-migrations] 1 pending of 279 migration files checked (run order):'
echo '  20261011210000-create-pulse-fits.js'
exit 1
`;
  const plan = (env = {}) => {
    const bin = path.join(tmp, 'bin');
    const app = path.join(tmp, 'app');
    fs.mkdirSync(bin);
    fs.mkdirSync(path.join(app, 'frontend', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(bin, 'git'), GIT, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'node'), NODE, { mode: 0o755 });
    const res = spawnSync('bash', ['-c', [
      'set -euo pipefail',
      ['die', 'redact', 'require_clean_tree', 'pending_check', 'unfinished_deploy_of', 'phase_plan'].map(fn).join('\n'),
      `PHASE=plan; TARGET=${TARGET}; DEPLOY_MARKER="$HOME/.episode-deploy-unfinished"`,
      `cd "${app}"`,
      'phase_plan',
    ].join('\n')], { env: { PATH: `${bin}:/usr/bin:/bin`, HOME: tmp, ...env }, encoding: 'utf8' });
    return { status: res.status, out: res.stdout, err: res.stderr };
  };

  test("the box stuck after run 64: its backup is there, so create-pulse-fits is carried and the plan finishes", () => {
    fs.mkdirSync(path.join(tmp, `dist-backup-20261011T214232Z-${HEAD.slice(0, 12)}`));
    const res = plan();
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    expect(res.out).toContain(`The box was put at ${HEAD} by a deploy that did not finish (the deploy's frontend backup ~/dist-backup-20261011T214232Z-${HEAD.slice(0, 12)}).`);
    expect(res.out).toMatch(/^PLAN_CARRIED=20261011210000-create-pulse-fits\.js$/m);
    expect(res.out).toMatch(/^PLAN_MIGRATIONS=2$/m);
    expect(res.out).toMatch(/^PLAN_MIGRATION=20261011230000-create-pulse-reveals\.js$/m);
    expect(res.out.trim().split('\n').pop()).toBe('PLAN_OK=1');
  });

  test('files pending with no sign of an unfinished workflow deploy still stop, changing nothing', () => {
    const res = plan();
    expect(res.status).toBe(1);
    expect(res.out).not.toMatch(/PLAN_OK|PLAN_CARRIED/);
    expect(res.err).toMatch(/STOPPED \(plan\): the pending-migration check on the current tree exited 1, not 0\./);
  });

  test('an unreadable ledger always stops, even with the backup there', () => {
    fs.mkdirSync(path.join(tmp, `dist-backup-20261011T214232Z-${HEAD.slice(0, 12)}`));
    const res = plan({ STUB_LEDGER: '2' });
    expect(res.status).toBe(1);
    expect(res.out).not.toMatch(/PLAN_OK|PLAN_CARRIED/);
    expect(res.err).toMatch(/exited 2, not 0/);
  });
});

