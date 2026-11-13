/**
 * Deploy to Development: a chosen commit, and a preflight before anything is
 * touched (Evoni, 2026-11-13).
 *
 *   1. scripts/dev-db/select-deploy-commit.sh, run for real in a scratch git
 *      repository with a stand-in gh: which commit a run installs, and which
 *      selections are refused.
 *   2. scripts/dev-db/preflight-dev-deploy.sh, run for real with stand-in df
 *      and psql: free disk, memory, and a database that is ahead of the commit.
 *      It changes nothing.
 *   3. deploy-dev-box.sh, run for real with a stand-in sudo: a refused
 *      preflight stops nothing.
 *   4. install-dev-app.sh: the disk guard comes before anything is removed, and
 *      the rollback tree is kept until the swap.
 *   5. .github/workflows/deploy-dev.yml, parsed: the same instance, role,
 *      environment and bucket prefix; the input is read in one place only.
 *
 * No database, no network, no root, no AWS.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const SELECT = path.join(ROOT, 'scripts/dev-db/select-deploy-commit.sh');
const PREFLIGHT = path.join(ROOT, 'scripts/dev-db/preflight-dev-deploy.sh');
const DEPLOY_BOX = path.join(ROOT, 'scripts/dev-db/deploy-dev-box.sh');
const INSTALLER = path.join(ROOT, 'scripts/dev-db/install-dev-app.sh');
const WORKFLOW = path.join(ROOT, '.github/workflows/deploy-dev.yml');

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-deploy-select-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const sh = (cwd, cmd, env = {}) => {
  const r = spawnSync('bash', ['-c', cmd], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd}: ${r.stderr}`);
  return r.stdout.trim();
};
const bin = (dir, name, body) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
};
/** Every file under a directory with its content, to show that nothing changed. */
const snapshot = (dir) => {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out[path.relative(dir, p)] = fs.readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return out;
};

// ── 1. Which commit ────────────────────────────────────────────────────────
describe('select-deploy-commit.sh: which commit a run installs', () => {
  const ALL_GREEN = { Tests: 'success', 'Route Validation': 'success', 'Cost Exposure Audit': 'success', ESLint: 'failure' };
  let repo; let state; let c1; let c2; let c3; let side;

  beforeEach(() => {
    repo = path.join(tmp, 'repo');
    state = path.join(tmp, 'gh-state');
    fs.mkdirSync(repo); fs.mkdirSync(state);
    const git = (cmd) => sh(repo, `git -c user.name=t -c user.email=t@example.com -c commit.gpgsign=false ${cmd}`);
    git('init -q -b main');
    fs.mkdirSync(path.join(repo, 'src/migrations'), { recursive: true });
    const commit = (name, file) => { fs.writeFileSync(path.join(repo, file), name); git('add -A'); git(`commit -q -m ${name}`); return git('rev-parse HEAD'); };
    c1 = commit('one', 'src/migrations/20260101000000-a.js');
    c2 = commit('two', 'README');
    c3 = commit('three', 'src/migrations/20260201000000-b.js');
    git('checkout -q -b side'); side = commit('side', 'side.txt'); git('checkout -q main');
    // A stand-in gh: `api …runs?head_sha=<sha>…` prints that sha's run ids; `api …runs/<id>/jobs…` prints "name<TAB>conclusion".
    bin(path.join(tmp, 'bin'), 'gh', `
      echo "gh $*" >> "${state}/calls"
      url="$2"
      case "$url" in
        *"/jobs"*) id="$(printf '%s' "$url" | sed -E 's#.*/runs/([0-9]+)/jobs.*#\\1#')"; cat "${state}/jobs-$id" 2>/dev/null || true ;;
        *"runs?head_sha="*) sha="$(printf '%s' "$url" | sed -E 's#.*head_sha=([0-9a-f]+).*#\\1#')"; cat "${state}/runs-$sha" 2>/dev/null || true ;;
      esac`);
  });

  const ci = (sha, runs) => {
    fs.writeFileSync(path.join(state, `runs-${sha}`), `${Object.keys(runs).join('\n')}\n`);
    for (const [id, jobs] of Object.entries(runs)) {
      fs.writeFileSync(path.join(state, `jobs-${id}`), `${Object.entries(jobs).map(([n, c]) => `${n}\t${c}`).join('\n')}\n`);
    }
  };
  const select = ({ commit = '', ref = 'refs/heads/main', head = c3 } = {}) => {
    const outFile = path.join(tmp, `out-${Math.random().toString(36).slice(2)}`);
    fs.writeFileSync(outFile, '');
    const r = spawnSync('bash', [SELECT], {
      cwd: repo, encoding: 'utf8',
      env: { ...process.env, PATH: `${path.join(tmp, 'bin')}:${process.env.PATH}`, COMMIT: commit, HEAD_SHA: head, REF_NAME: ref, REPO: 'o/r', MAIN_REF: 'main', GITHUB_OUTPUT: outFile },
    });
    const outputs = Object.fromEntries(fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean).map((l) => l.split('=')));
    return { status: r.status, out: `${r.stdout}${r.stderr}`, outputs };
  };
  const ghCalls = () => (fs.existsSync(path.join(state, 'calls')) ? fs.readFileSync(path.join(state, 'calls'), 'utf8') : '');

  test('no commit given: the dispatched commit, as before, from any ref, with no lookup here', () => {
    const r = select({ ref: 'refs/heads/some-branch', head: side });
    expect(r.status).toBe(0);
    expect(r.outputs).toEqual({ sha: side, explicit: 'false' });
    expect(ghCalls()).toBe('');
  });

  test('an earlier commit on main that CI verified is accepted: this is the rollback', () => {
    ci(c1, { 101: ALL_GREEN });
    const r = select({ commit: c1 });
    expect(r.status).toBe(0);
    expect(r.outputs).toEqual({ sha: c1, explicit: 'true' });
    expect(r.out).toContain(`Accepted: ${c1.slice(0, 12)} is on main and CI-verified.`);
    // Main has a migration this commit does not: said here, decided on the box.
    expect(r.out).toContain(`Note: main has 1 migration file(s) that ${c1.slice(0, 12)} does not.`);
  });

  test("main's tip is accepted too (a redeploy), with no migration note", () => {
    ci(c3, { 103: ALL_GREEN });
    const r = select({ commit: c3 });
    expect(r.status).toBe(0);
    expect(r.outputs.sha).toBe(c3);
    expect(r.out).not.toContain('Note: main has');
  });

  test.each([
    ['a short sha', () => c1.slice(0, 12)],
    ['an uppercase sha', () => c1.toUpperCase()],
    ['a branch name', () => 'main'],
    ['a sha with a command after it', () => `${c1}; touch ${path.join(tmp, 'pwned')}`],
    ['a command substitution', () => '$(touch pwned)'],
  ])('%s is refused before anything is looked up', (_n, value) => {
    ci(c1, { 101: ALL_GREEN });
    const r = select({ commit: value() });
    expect(r.status).toBe(1);
    expect(r.out).toContain('SELECT REFUSED: the commit must be a full, lowercase, 40-character sha.');
    expect(r.outputs).toEqual({});
    expect(ghCalls()).toBe('');
    expect(fs.existsSync(path.join(tmp, 'pwned'))).toBe(false);
    expect(fs.existsSync(path.join(repo, 'pwned'))).toBe(false);
  });

  test('a selected commit is refused unless the run was dispatched on main', () => {
    ci(c1, { 101: ALL_GREEN });
    const r = select({ commit: c1, ref: 'refs/heads/side' });
    expect(r.status).toBe(1);
    expect(r.out).toContain('SELECT REFUSED: a selected commit is deployed only from a run dispatched on main.');
    expect(r.outputs).toEqual({});
  });

  test('a commit that is not in the repository, or not on main, is refused', () => {
    const unknown = 'f'.repeat(40);
    ci(unknown, { 1: ALL_GREEN }); ci(side, { 2: ALL_GREEN });
    expect(select({ commit: unknown }).out).toContain('is not a commit in this repository');
    const offMain = select({ commit: side });
    expect(offMain.status).toBe(1);
    expect(offMain.out).toContain(`SELECT REFUSED: ${side.slice(0, 12)} is not on main.`);
    expect(offMain.outputs).toEqual({});
    expect(ghCalls()).toBe('');
  });

  test('a commit CI never ran for on main is refused: nothing is re-run in its place', () => {
    const r = select({ commit: c2 });
    expect(r.status).toBe(1);
    expect(r.out).toContain(`No Validate push run on main for ${c2.slice(0, 12)}.`);
    expect(r.out).toContain("SELECT REFUSED: main's CI did not pass Tests Route Validation Cost Exposure Audit");
    expect(r.outputs).toEqual({});
  });

  test.each([
    ['Tests failed', { ...ALL_GREEN, Tests: 'failure' }],
    ['Route Validation was cancelled', { ...ALL_GREEN, 'Route Validation': 'cancelled' }],
    ['Cost Exposure Audit is missing', { Tests: 'success', 'Route Validation': 'success' }],
    ['Tests is still running', { ...ALL_GREEN, Tests: 'null' }],
  ])('a required check that did not succeed (%s) is a refusal', (_n, jobs) => {
    ci(c1, { 101: jobs });
    const r = select({ commit: c1 });
    expect(r.status).toBe(1);
    expect(r.outputs).toEqual({});
  });

  test('the three checks must be green in the same run: two runs that each passed part are not enough', () => {
    ci(c1, { 101: { ...ALL_GREEN, Tests: 'failure' }, 102: { ...ALL_GREEN, 'Route Validation': 'failure' } });
    expect(select({ commit: c1 }).status).toBe(1);
    ci(c1, { 101: { ...ALL_GREEN, Tests: 'failure' }, 102: ALL_GREEN });
    expect(select({ commit: c1 }).status).toBe(0);
  });
});

// ── 2. Preflight ───────────────────────────────────────────────────────────
describe('preflight-dev-deploy.sh: safe to install? (read-only)', () => {
  const REF = 'a'.repeat(40);
  const APPLIED = ['20260101000000-a.js', '20260201000000-b.js'];

  function setup({ freeMib = 4096, memKb = [2000000, 1048576], applied = APPLIED, files = APPLIED, host = '127.0.0.1', psql = 'ok' } = {}) {
    const home = path.join(tmp, 'box');
    const conf = path.join(home, 'conf');
    fs.mkdirSync(conf, { recursive: true });
    fs.writeFileSync(path.join(conf, 'local-db.env'), `LOCAL_DB_HOST=${host}\nLOCAL_DB_PORT=5432\nLOCAL_DB_NAME=episode_metadata\nLOCAL_DB_USER=episode_dev\nLOCAL_DB_PASSWORD=not-a-real-password\n`);
    fs.writeFileSync(path.join(home, 'meminfo'), `MemTotal:       ${memKb[0]} kB\nSwapTotal:      ${memKb[1]} kB\n`);
    fs.writeFileSync(path.join(home, 'migrations.txt'), `${files.join('\n')}\n`);
    for (const [name, marker] of [['episode-metadata', 'LIVE'], ['episode-metadata.prev', 'ROLLBACK']]) {
      fs.mkdirSync(path.join(home, name)); fs.writeFileSync(path.join(home, name, 'marker'), marker);
    }
    const b = path.join(home, 'bin');
    bin(b, 'df', `echo "Filesystem 1048576-blocks Used Available Capacity Mounted on"; echo "/dev/root 7941 3000 ${freeMib} 50% /"`);
    bin(b, 'psql', psql === 'ok'
      ? `echo "psql host=$(echo "$*" | sed -E 's/.*-h ([^ ]+).*/\\1/')" >> "${home}/psql-calls"; printf '%s\\n' ${applied.map((a) => `'${a}'`).join(' ')}`
      : `echo "psql called" >> "${home}/psql-calls"; echo "psql: error: connection refused" >&2; exit 2`);
    return { home, conf, b };
  }
  function run(box, env = {}) {
    const r = spawnSync('bash', [PREFLIGHT], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${box.b}:${process.env.PATH}`, REF, MIGRATIONS_FILE: path.join(box.home, 'migrations.txt'), CONF: box.conf, MEMINFO: path.join(box.home, 'meminfo'), ...env },
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  }

  test('enough disk and memory, and a database the commit knows: OK, and nothing on the box changed', () => {
    const box = setup();
    const before = snapshot(box.home);
    const r = run(box);
    expect(r.status).toBe(0);
    expect(r.out).toContain('disk: 4096 MiB free on / (need 2048)');
    expect(r.out).toContain('schema: 2 applied; 0 of this commit\'s still to apply');
    expect(r.out).toContain(`PREFLIGHT OK for ${REF.slice(0, 12)}`);
    const after = snapshot(box.home);
    delete after['psql-calls'];
    expect(after).toEqual(before);
  });

  test('the default threshold is 2048 MiB: one below is refused, exactly 2048 passes', () => {
    expect(run(setup({ freeMib: 2048 })).status).toBe(0);
    fs.rmSync(path.join(tmp, 'box'), { recursive: true });
    const low = run(setup({ freeMib: 2047 }));
    expect(low.status).toBe(1);
    expect(low.out).toContain('PREFLIGHT REFUSED: 2047 MiB free is under the 2048 MiB an install needs.');
    expect(low.out).toContain('nothing was stopped, deleted or installed');
  });

  test("the box as it was on 2026-11-12 (404 MiB free) is refused", () => {
    const r = run(setup({ freeMib: 404 }));
    expect(r.status).toBe(1);
    expect(r.out).toContain('404 MiB free is under the 2048 MiB');
  });

  test('too little RAM + swap is refused', () => {
    const r = run(setup({ memKb: [1900000, 0] }));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/PREFLIGHT REFUSED: 1855 MiB of RAM \+ swap is under 2800 MiB/);
  });

  test('a rollback across a migration: the database is ahead of the commit, refused with the file names', () => {
    const box = setup({ applied: [...APPLIED, '20261111230000-converge-activity-logs.js'], files: APPLIED });
    const before = snapshot(box.home);
    const r = run(box);
    expect(r.status).toBe(1);
    expect(r.out).toContain(`PREFLIGHT REFUSED: the database has 1 migration(s) that ${REF.slice(0, 12)} does not have.`);
    expect(r.out).toContain('applied, not in this commit: 20261111230000-converge-activity-logs.js');
    const after = snapshot(box.home);
    delete after['psql-calls'];
    expect(after).toEqual(before);
  });

  test('a forward deploy with migrations still to apply is not a refusal: they are counted for the installer', () => {
    const r = run(setup({ applied: APPLIED, files: [...APPLIED, '20991231235959-new.js'] }));
    expect(r.status).toBe(0);
    expect(r.out).toContain("schema: 2 applied; 1 of this commit's still to apply");
  });

  test('a ledger that cannot be read is never "compatible"', () => {
    const r = run(setup({ psql: 'fail' }));
    expect(r.status).toBe(1);
    expect(r.out).toContain("PREFLIGHT REFUSED: the local database's migration ledger could not be read");
    expect(r.out).not.toContain('connection refused');
  });

  test('every failing reason is reported in one run', () => {
    const r = run(setup({ freeMib: 100, memKb: [1000000, 0], applied: [...APPLIED, '20991231235959-new.js'] }));
    expect(r.status).toBe(1);
    expect(r.out.match(/PREFLIGHT REFUSED/g)).toHaveLength(3);
  });

  test('a database login that is not local is refused before anything is read', () => {
    const box = setup({ host: 'canon.cluster.example' });
    const r = run(box);
    expect(r.status).toBe(2);
    expect(r.out).toContain('PREFLIGHT REFUSED: the database login is not for a local database.');
    expect(fs.existsSync(path.join(box.home, 'psql-calls'))).toBe(false);
    expect(r.out).not.toContain('canon.cluster.example');
  });

  test('bad arguments: no sha, no migrations file, an empty one, a threshold that is not a number', () => {
    const box = setup();
    expect(run(box, { REF: 'main' }).status).toBe(2);
    expect(run(box, { MIGRATIONS_FILE: path.join(box.home, 'missing.txt') }).status).toBe(2);
    expect(run(box, { MIN_FREE_MIB: 'lots' }).status).toBe(2);
    fs.writeFileSync(path.join(box.home, 'migrations.txt'), '\n');
    const empty = run(box);
    expect(empty.status).toBe(1);
    expect(empty.out).toContain('MIGRATIONS_FILE names no migration file');
  });

  test('it prints numbers and file names: never the password or the database host', () => {
    const r = run(setup());
    expect(r.out).not.toContain('not-a-real-password');
    expect(r.out).not.toContain('127.0.0.1');
    expect(r.out).not.toContain('episode_dev');
  });
});

// ── 3. The box script ──────────────────────────────────────────────────────
describe('deploy-dev-box.sh: a refused preflight stops nothing', () => {
  const REF = 'b'.repeat(40);
  function runBox(preflightBody) {
    const b = path.join(tmp, 'bin');
    const calls = path.join(tmp, 'calls');
    for (const tool of ['sudo', 'pm2', 'curl', 'ss']) bin(b, tool, `echo "${tool} $*" >> "${calls}"; exit 0`);
    const pre = path.join(tmp, 'preflight.sh');
    if (preflightBody !== null) fs.writeFileSync(pre, `#!/usr/bin/env bash\n${preflightBody}\n`, { mode: 0o755 });
    const installer = path.join(tmp, 'installer.sh');
    fs.writeFileSync(installer, `#!/usr/bin/env bash\necho "installer ran" >> "${calls}"; exit 1\n`, { mode: 0o755 });
    fs.writeFileSync(path.join(tmp, 'migrations.txt'), '20260101000000-a.js\n');
    const r = spawnSync('bash', [DEPLOY_BOX], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${b}:${process.env.PATH}`, REF, DIST_TARBALL: '/nonexistent', DIST_SHA256: 'x', MIGRATIONS_FILE: path.join(tmp, 'migrations.txt'), INSTALLER: installer, PREFLIGHT: pre, APP_USER: 'tester' },
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}`, calls: fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8') : '' };
  }

  test('preflight refuses: exit 1, and no command that stops, installs or starts anything was run', () => {
    const r = runBox('echo "PREFLIGHT REFUSED: 404 MiB free"; exit 1');
    expect(r.status).toBe(1);
    expect(r.out).toContain('PREFLIGHT REFUSED: 404 MiB free');
    expect(r.out).toContain('the dev app was not stopped; the live and rollback trees are as they were');
    expect(r.calls).toBe('');
    expect(r.out).not.toContain('== stop the dev app');
  });

  test('the preflight script is missing: exit 1, nothing run', () => {
    const r = runBox(null);
    expect(r.status).toBe(1);
    expect(r.out).toContain('PREFLIGHT MISSING');
    expect(r.calls).toBe('');
  });

  test('the preflight gets the commit and its migration list, and only after it passes is the app stopped', () => {
    const r = runBox(`echo "preflight REF=$REF MIGRATIONS_FILE=$(basename "$MIGRATIONS_FILE")" >> "${path.join(tmp, 'calls')}"; exit 0`);
    const lines = r.calls.trim().split('\n');
    expect(lines[0]).toBe(`preflight REF=${REF} MIGRATIONS_FILE=migrations.txt`);
    expect(lines[1]).toMatch(/^sudo .*pm2 stop episode-api episode-worker/);
  });

  test('by its text: the preflight is the first step, and MIGRATIONS_FILE is required', () => {
    const text = fs.readFileSync(DEPLOY_BOX, 'utf8');
    expect(text.indexOf('step "preflight')).toBeGreaterThan(0);
    expect(text.indexOf('step "preflight')).toBeLessThan(text.indexOf('step "stop the dev app"'));
    expect(text).toContain('MIGRATIONS_FILE="${MIGRATIONS_FILE:?');
    const r = spawnSync('bash', [DEPLOY_BOX], { encoding: 'utf8', env: { ...process.env, REF, DIST_TARBALL: 'x', DIST_SHA256: 'x', MIGRATIONS_FILE: '' } });
    expect(r.status).not.toBe(0);
  });
});

// ── 4. The installer ───────────────────────────────────────────────────────
describe('install-dev-app.sh: room is checked before anything is removed, and the rollback tree is kept until the swap', () => {
  const installer = fs.readFileSync(INSTALLER, 'utf8');

  test('the rollback tree is removed in one place only, at the swap', () => {
    const removals = [...installer.matchAll(/rm -rf "\$PREV"/g)].map((m) => m.index);
    expect(removals).toHaveLength(1);
    expect(removals[0]).toBeGreaterThan(installer.indexOf('step "swap trees"'));
    expect(installer).not.toContain('free the previous rollback tree');
  });

  test('the disk guard comes after the memory guard and before the clone, the first thing that writes', () => {
    const disk = installer.indexOf('step "disk guard');
    expect(disk).toBeGreaterThan(installer.indexOf('step "memory guard'));
    expect(disk).toBeLessThan(installer.indexOf('rm -rf "$STAGE"'));
    expect(disk).toBeLessThan(installer.indexOf('step "clone'));
    expect(installer).toContain('MIN_FREE_MIB="${MIN_FREE_MIB:-2048}"');
  });

  test('the guard itself, run on scratch trees: under the threshold exits 1 and removes nothing; at it, goes on', () => {
    const from = installer.indexOf('step "disk guard');
    const guard = installer.slice(from, installer.indexOf('\n\n', from));
    const run = (freeMib) => {
      const home = path.join(tmp, `home-${freeMib}`);
      for (const name of ['episode-metadata', 'episode-metadata.prev', 'episode-metadata.next']) {
        fs.mkdirSync(path.join(home, name), { recursive: true }); fs.writeFileSync(path.join(home, name, 'marker'), name);
      }
      bin(path.join(home, 'bin'), 'df', `echo "Filesystem 1048576-blocks Used Available Capacity Mounted on"; echo "/dev/root 7941 3000 ${freeMib} 50% /"`);
      const harness = path.join(home, 'harness.sh');
      fs.writeFileSync(harness, ['set -euo pipefail', 'MIN_FREE_MIB=2048', 'step() { echo "== $*"; }', guard, 'echo "went on"'].join('\n'));
      const r = spawnSync('bash', [harness], { encoding: 'utf8', env: { ...process.env, PATH: `${path.join(home, 'bin')}:${process.env.PATH}` } });
      return { status: r.status, out: `${r.stdout}${r.stderr}`, trees: fs.readdirSync(home).filter((n) => n.startsWith('episode-metadata')).sort() };
    };
    const low = run(2047);
    expect(low.status).toBe(1);
    expect(low.out).toContain('refusing: 2047 MiB free < 2048 MiB; nothing was removed or installed');
    expect(low.out).not.toContain('went on');
    expect(low.trees).toEqual(['episode-metadata', 'episode-metadata.next', 'episode-metadata.prev']);
    expect(run(2048)).toMatchObject({ status: 0 });
  });
});

// ── 5. The workflow ────────────────────────────────────────────────────────
describe('deploy-dev.yml: same target, same credentials, one place that reads the input', () => {
  const text = fs.readFileSync(WORKFLOW, 'utf8');
  const wf = yaml.load(text);
  const on = wf.on || wf[true];
  const runBlocks = Object.values(wf.jobs).flatMap((j) => (j.steps || []).map((s) => s.run).filter(Boolean));

  test('still dispatched by hand only, with one optional input', () => {
    expect(Object.keys(on)).toEqual(['workflow_dispatch']);
    expect(Object.keys(on.workflow_dispatch.inputs)).toEqual(['commit']);
    expect(on.workflow_dispatch.inputs.commit).toMatchObject({ required: false, default: '', type: 'string' });
    expect(text).not.toMatch(/^\s*push:/m);
  });

  test('the development-only target, role, environment and staging prefix are unchanged', () => {
    expect(wf.env).toEqual({ AWS_REGION: 'us-east-1', DEPLOY_BUCKET: 'episode-metadata-storage-dev', DEPLOY_PREFIX: 'deploys/dev', INSTANCE_TAG: 'episode-dev-backend' });
    expect(wf.jobs.deploy.environment).toEqual({ name: 'development' });
    const creds = wf.jobs.deploy.steps.find((s) => String(s.uses || '').startsWith('aws-actions/configure-aws-credentials'));
    expect(creds.with).toEqual({ 'role-to-assume': 'arn:aws:iam::637423256673:role/episode-gha-deploy-dev', 'aws-region': 'us-east-1' });
    expect(text.match(/role-to-assume/g)).toHaveLength(1);
    expect(text).toContain('--filters "Key=tag:Name,Values=${INSTANCE_TAG}"');
    expect(text).toContain('--document-name "AWS-RunShellScript"');
    expect(wf.concurrency).toEqual({ group: 'deploy-dev', 'cancel-in-progress': false });
  });

  test('the input is read in exactly one place, as an environment value, never inside a shell command', () => {
    expect(text.match(/inputs\.commit/g)).toHaveLength(1);
    expect(wf.jobs.select.steps.find((s) => s.id === 'select').env.COMMIT).toBe('${{ inputs.commit }}');
    for (const run of runBlocks) {
      expect(run).not.toMatch(/\$\{\{\s*(inputs|github\.event\.inputs)\./);
      expect(run).not.toMatch(/\$\{\{\s*needs\.select\.outputs\.sha/);
    }
  });

  test('every job waits for the selection, and a refused selection deploys nothing', () => {
    expect(wf.jobs['ci-tests'].needs).toBe('select');
    for (const job of ['test', 'build', 'deploy']) {
      expect(wf.jobs[job].needs).toContain('select');
      expect(wf.jobs[job].if).toContain("needs.select.result == 'success'");
    }
    expect(wf.jobs.select.steps[0].with['fetch-depth']).toBe(0);
    expect(wf.jobs.select.steps.find((s) => s.id === 'select').run).toContain('bash scripts/dev-db/select-deploy-commit.sh');
    expect(wf.jobs.select.steps.find((s) => s.id === 'select').run).toContain('exit "${PIPESTATUS[0]}"');
  });

  test('the application is the selected commit; the on-box scripts are always this workflow\'s own commit', () => {
    const [app, tooling] = wf.jobs.build.steps.filter((s) => String(s.uses || '').startsWith('actions/checkout'));
    expect(app.with.ref).toBe('${{ needs.select.outputs.sha }}');
    expect(tooling.with).toMatchObject({ ref: '${{ github.sha }}', path: 'tooling' });
    const pack = wf.jobs.build.steps.find((s) => s.id === 'pack').run;
    expect(pack).toContain('cp tooling/scripts/dev-db/install-dev-app.sh tooling/scripts/dev-db/deploy-dev-box.sh tooling/scripts/dev-db/preflight-dev-deploy.sh out/');
    expect(pack).toContain('( cd src/migrations && ls -1 *.js | LC_ALL=C sort ) > out/migrations.txt');
    expect(pack).toContain('sha256sum dist.tar.gz install-dev-app.sh deploy-dev-box.sh preflight-dev-deploy.sh migrations.txt');
    expect(wf.jobs.test.steps[0].with.ref).toBe('${{ needs.select.outputs.sha }}');
    // github.sha is left in two places only: what was dispatched, and the tooling.
    expect(text.match(/github\.sha/g)).toHaveLength(2);
  });

  test('the box verifies all five files, then runs the box script with the preflight and the migration list', () => {
    const deploy = wf.jobs.deploy.steps.find((s) => s.name === 'Deploy via SSM RunCommand');
    expect(deploy.env.SHA).toBe('${{ needs.select.outputs.sha }}');
    expect(deploy.run).toContain('[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]');
    expect(deploy.run).toContain("'$PRE_SHA' '$D/preflight-dev-deploy.sh' '$MIG_SHA' '$D/migrations.txt' | sha256sum -c -");
    expect(deploy.run).toContain("MIGRATIONS_FILE='$D/migrations.txt' INSTALLER='$D/install-dev-app.sh' PREFLIGHT='$D/preflight-dev-deploy.sh' bash '$D/deploy-dev-box.sh'");
    expect(deploy.run).toContain('if [ "$STATUS" != "Success" ]; then');
    const cleanup = wf.jobs.deploy.steps.find((s) => s.name === 'Cleanup S3 deploy objects');
    expect(cleanup.run).toContain('aws s3 rm "s3://${DEPLOY_BUCKET}/${DEPLOY_PREFIX}/${SHA}/"');
  });
});
