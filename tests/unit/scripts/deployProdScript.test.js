// ============================================================================
// Task #2161 — scripts/deploy-prod.sh, run only here, against PATH stubs.
// ============================================================================
// Each case builds a throwaway "repo root" in a temp dir and runs the real
// script there with stub git, pm2, node (the pending-migration check only;
// anything else goes to the real node), curl, npx and sleep first on PATH.
// No host, pm2, database or network is touched: every external command the
// script calls is a stub that logs its arguments. The tests check that the
// script stops at each hazard, prints rollback text without running it, and
// ends with a summary that carries no host, IP address or key value.
// ============================================================================

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'deploy-prod.sh');
const OLD = '1111111111111111111111111111111111111111';
const NEW = '2222222222222222222222222222222222222222';
const APP = 'episode-api-prod-hotfix';
const SECRET_KEY = 'sk-ant-TESTVALUE-never-printed';
const DB_HOST = 'canon-db.abc123.us-east-1.rds.amazonaws.com';

// The stubs. Scenario comes from STUB_* env vars; every call is appended to
// $STUB_LOG as "<cmd> <args>".
const STUBS = {
  git: `#!/usr/bin/env bash
echo "git $*" >> "$STUB_LOG"
head_file="$STUB_STATE/head"
[ -f "$head_file" ] || echo "${OLD}" > "$head_file"
case "$1" in
  rev-parse)
    if [ "$2" = "HEAD" ]; then cat "$head_file"; else echo "${NEW}"; fi ;;
  status)
    if [ "$2" = "--short" ]; then printf '%s' "$STUB_STATUS_SHORT"; else printf '%s' "$STUB_STATUS_TRACKED"; fi ;;
  fetch) exit 0 ;;
  rev-list) echo "$STUB_COUNT" ;;
  log)
    if [ "$2" = "--oneline" ]; then printf '2222222 feat: two (#2151)\\n1212121 feat: one (#2149)\\n';
    else printf 'feat: two (#2151)\\nfeat: one (#2149)\\n'; fi ;;
  diff)
    case "$*" in
      *"-- src/migrations/"*) printf '%s' "$STUB_MIGRATIONS" ;;
      *"-- package.json"*) printf '%s' "$STUB_PACKAGES" ;;
      *) printf 'src/a.js\\nsrc/b.js\\nfrontend/src/c.jsx\\n' ;;
    esac ;;
  merge)
    if [ "$STUB_MERGE_RC" = "0" ]; then echo "${NEW}" > "$head_file"; echo "Fast-forward"; exit 0; fi
    echo "fatal: Not possible to fast-forward, aborting." >&2; exit 128 ;;
  *) echo "unexpected git call: $*" >&2; exit 97 ;;
esac
`,
  pm2: `#!/usr/bin/env bash
echo "pm2 $*" >> "$STUB_LOG"
case "$1" in
  describe) [ "$2" = "$STUB_APP" ] ;;
  restart) echo "[PM2] Applying action restartProcessId on app [$2]"; echo "[PM2] [$2](0) ✓" ;;
  save) echo "[PM2] Saving current process list..." ;;
  jlist) echo '[{"name":"'"$STUB_APP"'","pm2_env":{"restart_time":12}}]' ;;
  logs)
    echo "0|episode- | 2026-09-28 12:40:00: 🔗 Ready to accept requests"
    echo "0|episode- | 2026-09-28 12:40:05: [CFO] ✅ Audit complete — Score: 70/100 | 2 critical | 4 warnings | 900ms"
    echo "0|episode- | 2026-09-28 12:48:09: 🔗 Ready to accept requests (on ip-10-0-1-5, 10.0.1.5)"
    echo "0|episode- | 2026-09-28 12:48:18: [CFO] ⏰ Scheduled audit starting..."
    echo "0|episode- | 2026-09-28 12:48:22: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 812ms" ;;
  *) echo "unexpected pm2 call: $*" >&2; exit 97 ;;
esac
`,
  node: `#!/usr/bin/env bash
case "$*" in
  *check-pending-migrations*)
    echo "node $* NODE_ENV=$NODE_ENV" >> "$STUB_LOG"
    echo "[pending-migrations] reading SequelizeMeta: NODE_ENV=$NODE_ENV → ${DB_HOST}:5432/episode_metadata as episode_app_dev"
    if [ "$STUB_PENDING_RC" = "0" ]; then echo "[pending-migrations] OK: 0 pending of 220 migration files checked.";
    else echo "[pending-migrations] 1 pending of 221 migration files checked (run order):"; echo "  20260929000000-x.js"; echo "[pending-migrations] FAIL: pending migrations. Do not restart."; fi
    exit "$STUB_PENDING_RC" ;;
  *) exec "$REAL_NODE" "$@" ;;
esac
`,
  curl: `#!/usr/bin/env bash
echo "curl $*" >> "$STUB_LOG"
printf '%s' "$STUB_HEALTH_BODY"
`,
  npx: `#!/usr/bin/env bash
echo "npx $* (cwd: $(basename "$PWD"))" >> "$STUB_LOG"
if [ "$STUB_BUILD_RC" = "0" ]; then echo "vite v7.0.0 building for production..."; echo "✓ built in 14.98s"; exit 0; fi
echo "error during build: boom"; exit 1
`,
  sleep: `#!/usr/bin/env bash
echo "sleep $*" >> "$STUB_LOG"
`,
};

const HEALTHY = '{"status":"healthy","timestamp":"2026-09-28T12:48:34.363Z","uptime":30.1,"version":"1.0.0","environment":"production","database":"connected"}';
const DOWN = '{"status":"unhealthy","database":"disconnected"}';

let tmpRoot;
beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deployprod-'));
});
afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

let caseN = 0;
// Builds a fake repo root, home and stub dir; runs the script; returns
// { status, out, calls, home, root }.
function run({
  env = {}, input = 'y\ny\n', args = [], asRepoRoot = true, stubs = {},
} = {}) {
  caseN += 1;
  const base = path.join(tmpRoot, `case${caseN}`);
  const root = path.join(base, 'repo');
  const home = path.join(base, 'home');
  const bin = path.join(base, 'bin');
  const state = path.join(base, 'state');
  for (const d of [root, home, bin, state, path.join(root, '.git'), path.join(root, 'scripts'), path.join(root, 'frontend', 'dist')]) {
    fs.mkdirSync(d, { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, 'scripts', 'check-pending-migrations.js'), '// stubbed');
  fs.writeFileSync(path.join(root, 'frontend', 'dist', 'index.html'), '<script src="/assets/index-old.js"></script>');
  fs.writeFileSync(path.join(root, '.env'), `DB_HOST=${DB_HOST}\nANTHROPIC_API_KEY=${SECRET_KEY}\n`);
  for (const [name, body] of Object.entries({ ...STUBS, ...stubs })) {
    const p = path.join(bin, name);
    fs.writeFileSync(p, body);
    fs.chmodSync(p, 0o755);
  }
  const log = path.join(base, 'calls.log');
  fs.writeFileSync(log, '');

  const childEnv = {
    PATH: `${bin}:${process.env.PATH}`,
    HOME: home,
    REAL_NODE: process.execPath,
    STUB_LOG: log,
    STUB_STATE: state,
    STUB_APP: APP,
    STUB_STATUS_SHORT: '?? Production\n?? sed\n',
    STUB_STATUS_TRACKED: '',
    STUB_COUNT: '2',
    STUB_MIGRATIONS: '',
    STUB_PACKAGES: '',
    STUB_MERGE_RC: '0',
    STUB_BUILD_RC: '0',
    STUB_PENDING_RC: '0',
    STUB_HEALTH_BODY: HEALTHY,
    ...env,
  };
  // The script refuses under Claude Code; every case but the refusal test
  // runs without CLAUDECODE.
  if (!('CLAUDECODE' in env)) delete childEnv.CLAUDECODE;

  const r = spawnSync('bash', [SCRIPT, ...args], {
    cwd: asRepoRoot ? root : base, env: childEnv, input, encoding: 'utf8', timeout: 30000,
  });
  return {
    status: r.status,
    out: `${r.stdout}${r.stderr}`,
    calls: fs.readFileSync(log, 'utf8'),
    home,
    root,
  };
}

// Nothing the script may never do: edit .env, migrate, install, reset, delete.
function expectNothingForbidden({ calls, root }) {
  expect(calls).not.toMatch(/\bgit reset\b|\bgit checkout\b|\bgit clean\b|\bnpm\b|migrate|db:migrate|\brm\b/);
  expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toBe(`DB_HOST=${DB_HOST}\nANTHROPIC_API_KEY=${SECRET_KEY}\n`);
}
const backups = (home) => fs.readdirSync(home).filter((f) => f.startsWith('dist-backup-') && !f.endsWith('.log'));

describe('refuses to start', () => {
  test('under Claude Code (CLAUDECODE set)', () => {
    const r = run({ env: { CLAUDECODE: '1' } });
    expect(r.status).toBe(2);
    expect(r.out).toMatch(/REFUSED: CLAUDECODE is set/);
    expect(r.calls).toBe('');
  });

  test('outside the repo root', () => {
    const r = run({ asRepoRoot: false });
    expect(r.status).toBe(2);
    expect(r.out).toMatch(/REFUSED: Run this from the repo root/);
  });

  test('when the pm2 app does not exist; --app names another', () => {
    const r = run({ env: { STUB_APP: 'something-else' } });
    expect(r.status).toBe(2);
    expect(r.out).toMatch(/REFUSED: pm2 has no app named 'episode-api-prod-hotfix'/);
    const r2 = run({ env: { STUB_APP: 'something-else' }, args: ['--app', 'something-else'] });
    expect(r2.status).toBe(0);
  });
});

describe('stops before changing anything', () => {
  test('nothing to deploy exits 0 cleanly', () => {
    const r = run({ env: { STUB_COUNT: '0' } });
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/Nothing to deploy/);
    expect(r.calls).not.toMatch(/git merge|npx|pm2 restart/);
    expect(backups(r.home)).toEqual([]);
  });

  test('a modified tracked file stops it (untracked files are fine)', () => {
    const r = run({ env: { STUB_STATUS_TRACKED: ' M src/app.js\n' } });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/STOPPED: Tracked files are modified/);
    expect(r.out).toMatch(/Nothing has been changed/);
    expect(r.calls).not.toMatch(/git fetch|git merge/);
  });

  test('a migration in range stops it and points to §7.1', () => {
    const r = run({ env: { STUB_MIGRATIONS: 'src/migrations/20260929000000-x.js\n' } });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/STOPPED: Migration files change in this range/);
    expect(r.out).toMatch(/20260929000000-x\.js/);
    expect(r.out).toMatch(/DEVELOPMENT_WORKFLOW\.md §7\.1/);
    expect(r.calls).not.toMatch(/git merge|npx|pm2 restart|check-pending/);
    expect(backups(r.home)).toEqual([]);
    expectNothingForbidden(r);
  });

  test('a package change stops it and says npm ci is needed, without running it', () => {
    const r = run({ env: { STUB_PACKAGES: 'package-lock.json\n' } });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/npm ci is needed before continuing/);
    expect(r.calls).not.toMatch(/git merge|npx/);
    expectNothingForbidden(r);
  });
});

describe('stops after the backup, with rollback text it does not run', () => {
  test('a refused fast-forward', () => {
    const r = run({ env: { STUB_MERGE_RC: '1' } });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/STOPPED: git merge --ff-only .* was refused/);
    expect(backups(r.home)).toHaveLength(1);
    expect(r.calls).not.toMatch(/npx|pm2 restart/);
    expectNothingForbidden(r);
  });

  test('a failed build', () => {
    const r = run({ env: { STUB_BUILD_RC: '1' } });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/STOPPED: The vite build failed/);
    expect(r.out).toContain(`git reset --hard ${OLD}`);
    expect(r.out).toMatch(/cp -a ~\/dist-backup-\d{8}T\d{6}Z frontend\/dist/);
    expect(r.calls).not.toMatch(/check-pending|pm2 restart/);
    expectNothingForbidden(r);
  });

  test('pending migrations (exit 1)', () => {
    const r = run({ env: { STUB_PENDING_RC: '1' } });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/STOPPED: The pending-migration check exited 1/);
    expect(r.out).toMatch(/the API still runs the old code/);
    expect(r.calls).not.toMatch(/pm2 restart/);
    expectNothingForbidden(r);
  });

  test('"no" to the database question', () => {
    const r = run({ input: 'n\n' });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/STOPPED: You did not confirm the database/);
    expect(r.calls).not.toMatch(/pm2 restart/);
  });

  test('"no" (or no answer) to the restart question', () => {
    const r = run({ input: 'y\n' });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/STOPPED: You chose not to restart/);
    expect(r.calls).not.toMatch(/pm2 restart/);
  });

  test('an unhealthy /health after the restart: 20 polls, then rollback text', () => {
    const r = run({ env: { STUB_HEALTH_BODY: DOWN } });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/STOPPED: \/health did not report healthy with the database connected within 60 s/);
    expect(r.out).toContain(`git reset --hard ${OLD}`);
    expect(r.out).toMatch(/cp -a ~\/dist-backup-\d{8}T\d{6}Z frontend\/dist/);
    expect(r.out).toContain(`pm2 restart ${APP}                 # after steps 1 and 2`);
    expect((r.calls.match(/^curl /gm) || []).length).toBe(20);
    expect((r.calls.match(/^sleep 3$/gm) || []).length).toBe(20);
    expect((r.calls.match(/^pm2 restart/gm) || []).length).toBe(1);
    expectNothingForbidden(r);
  });
});

describe('the happy path', () => {
  let r;
  beforeAll(() => { r = run(); });

  test('exits 0 after one plain restart, with the pending check run under NODE_ENV=production', () => {
    expect(r.status).toBe(0);
    expect(r.calls).toMatch(/^pm2 restart episode-api-prod-hotfix$/m);
    expect(r.calls).not.toMatch(/--update-env|pm2 save/);
    expect(r.calls).toMatch(/check-pending-migrations\.js NODE_ENV=production/);
    expect(r.calls).toMatch(/^npx vite build \(cwd: frontend\)$/m);
    expect(backups(r.home)).toHaveLength(1);
    expectNothingForbidden(r);
  });

  test('prints the summary block with the deploy facts', () => {
    const summary = r.out.slice(r.out.indexOf('===== Paste this into a session for the deploy record ====='));
    expect(summary).toContain(`Tree: ${OLD} -> ${NEW} (fast-forward)`);
    expect(summary).toContain('Range: 2 commit(s), 3 file(s); PRs: #2149 #2151');
    expect(summary).toMatch(/Backup: frontend\/dist -> ~\/dist-backup-\d{8}T\d{6}Z/);
    expect(summary).toContain('vite build: built in 14.98s');
    expect(summary).toContain('Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev');
    expect(summary).toContain('Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0)');
    expect(summary).toContain('ANTHROPIC_API_KEY in .env: count 1 (value not read)');
    expect(summary).toContain('Restart: plain pm2 restart episode-api-prod-hotfix; restart count 12');
    expect(summary).toContain('"status":"healthy"');
    expect(summary).toContain('"database":"connected"');
    expect(summary).toMatch(/Ready line: .*12:48:09.*Ready to accept requests/);
    expect(summary).toContain('Score: 84/100');
    expect(summary).not.toContain('Score: 70/100'); // only lines since the latest Ready
    expect(summary).toMatch(/===== end =====/);
  });

  test('no host, IP address or key value anywhere in the output', () => {
    expect(r.out).not.toContain(DB_HOST);
    expect(r.out).not.toMatch(/amazonaws\.com/);
    expect(r.out).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
    expect(r.out).not.toMatch(/ip-10-0-1-5/);
    expect(r.out).not.toContain(SECRET_KEY);
  });
});

test('--update-env restarts with --update-env, then pm2 save', () => {
  const r = run({ args: ['--update-env'] });
  expect(r.status).toBe(0);
  expect(r.calls).toMatch(/^pm2 restart episode-api-prod-hotfix --update-env$/m);
  expect(r.calls.indexOf('pm2 save')).toBeGreaterThan(r.calls.indexOf('pm2 restart'));
  expect(r.out).toContain('pm2 restart episode-api-prod-hotfix --update-env, then pm2 save; restart count 12');
});
