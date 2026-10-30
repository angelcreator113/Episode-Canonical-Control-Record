// ============================================================================
// Deploy safety PR 1 (Evoni, 2026-10-26): the migrate phase runs before the
// deploy phase, from a staged copy of the target commit, while the live tree
// and the running API stay on the old code.
// ============================================================================
// The script itself is never run here (it refuses outside the box, and only
// the Deploy workflow runs it). As in the other workflowDeploy tests, its
// functions are cut out and run alone in bash, here against a real throwaway
// git repository laid out like the box (an app directory with an untracked
// .env, uploads/, logs/, frontend/dist and node_modules), with stubs for the
// ledger check and sequelize-cli. No host, AWS, database or network.
// ============================================================================

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const SCRIPT_TEXT = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy', 'workflow-deploy.sh'), 'utf8');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
const RUNBOOK = fs.readFileSync(path.join(ROOT, 'docs', 'runbooks', 'deploy-workflow.md'), 'utf8');

/** A top-level bash function's text, from "name() {" to its closing "}" at column 0. */
function fn(name) {
  const m = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n`, 'm').exec(SCRIPT_TEXT);
  if (!m) throw new Error(`${name}() not found`);
  return m[0];
}
const STAGE_PATHS_LINE = /^STAGE_PATHS=\(.*\)$/m.exec(SCRIPT_TEXT)[0];
const LOCK_TIMEOUT_LINE = /^MIGRATE_LOCK_TIMEOUT=.*$/m.exec(SCRIPT_TEXT)[0];
const VOICE_WORKER_LINE = /^VOICE_WORKER_APP=.*$/m.exec(SCRIPT_TEXT)[0];
const BACKUP_KEEP_LINE = /^BACKUP_KEEP=.*$/m.exec(SCRIPT_TEXT)[0];

const MIGRATE_FNS = ['die', 'redact', 'require_clean_tree', 'pending_check', 'processes_using', 'remove_stage',
  'clean_stages', 'stage_release', 'verify_stage', 'finish_migrate', 'phase_migrate', 'require_migrated'];
const RESTART_FNS = ['die', 'redact', 'require_at_target', 'require_migrated', 'verify_stage', 'pending_check',
  'processes_using', 'remove_stage', 'pm2_state', 'pm2_status', 'prune_backups', 'phase_restart'];

const GIT_ENV = {
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
};
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

let tmp; let home; let app; let bin; let calls; let ledger;

function git(...args) {
  const res = spawnSync('git', args, { cwd: app, env: { ...process.env, ...GIT_ENV }, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
  return res.stdout.trim();
}
function write(rel, text, mode) {
  const p = path.join(app, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, mode ? { mode } : undefined);
}
function commit(msg) { git('add', '-A'); git('commit', '-q', '-m', msg); return git('rev-parse', 'HEAD'); }

// The ledger check, as the box runs it: from its own tree's root, reading
// that tree's .env (dotenv's default) and listing its migration files.
const CHECK = `const fs = require('fs'), path = require('path');
process.chdir(path.resolve(__dirname, '..'));
fs.appendFileSync(process.env.CALLS, 'check cwd=' + process.cwd() + ' env=' + fs.readFileSync('.env', 'utf8').trim() + '\\n');
if (process.env.STUB_LEDGER === '2') { console.log('[pending-migrations] ERROR: could not read "SequelizeMeta": timeout'); process.exit(2); }
const done = fs.existsSync(process.env.LEDGER) ? fs.readFileSync(process.env.LEDGER, 'utf8').split('\\n').filter(Boolean) : [];
const files = fs.readdirSync('src/migrations').filter((f) => f.endsWith('.js')).sort();
const pending = files.filter((f) => !done.includes(f));
if (!pending.length) { console.log('[pending-migrations] OK: 0 pending of ' + files.length + ' migration files checked.'); process.exit(0); }
console.log('[pending-migrations] ' + pending.length + ' pending of ' + files.length + ' migration files checked (run order):');
for (const f of pending) console.log('  ' + f);
process.exit(1);
`;

// sequelize-cli in the live node_modules: records where it ran and what it
// saw, then "applies" every migration file it was pointed at, or fails.
const CLI = `#!/usr/bin/env bash
mig=""; prev=""
for a in "$@"; do if [ "$prev" = "--migrations-path" ]; then mig="$a"; fi; prev="$a"; done
{
  echo "cli cwd=$(pwd -P)"
  echo "cli args=$*"
  echo "cli env=$(cat .env) link=$(readlink .env) modules=$(readlink node_modules) node_env=$NODE_ENV user=$DB_USER"
  echo "cli pgoptions=\${PGOPTIONS:-}"
  echo "cli live_head=$(git -C "$LIVE_APP" rev-parse HEAD)"
  echo "cli b=$(tr -d '\\n' <"$mig/20261026000002-add-b.js") model=$(tr -d '\\n' <src/models/x.js)"
  echo "cli staged=$(find . -mindepth 1 -maxdepth 1 -printf '%P ' | tr ' ' '\\n' | sort | tr '\\n' ' ')"
} >>"$CALLS"
if [ "\${STUB_MIGRATE:-ok}" = "fail" ]; then echo 'ERROR: column "b" of relation "episodes" already exists'; exit 1; fi
# Another connection holds the table past lock_timeout (Deploy run 176).
if [ "\${STUB_MIGRATE:-ok}" = "lock" ]; then echo 'ERROR: canceling statement due to lock timeout'; exit 1; fi
# The phase killed mid-migration (an SSM timeout): its bash goes, this keeps running.
if [ "\${STUB_MIGRATE:-ok}" = "kill" ]; then kill -9 "$PHASE_PID"; exit 0; fi
# A staged file changed while the migration runs.
if [ "\${STUB_MIGRATE:-ok}" = "tamper" ]; then chmod u+w src/models/x.js; echo changed >>src/models/x.js; fi
for f in "$mig"/*.js; do n="$(basename "$f")"; grep -qxF "$n" "$LEDGER" 2>/dev/null || echo "$n" >>"$LEDGER"; done
echo '== 20261026000002-add-b: migrated'
`;

let OLD; let TARGET; let PKG; let SIDE;

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-staged-')));
  home = path.join(tmp, 'home');
  app = path.join(home, 'episode-metadata');
  bin = path.join(tmp, 'bin');
  calls = path.join(tmp, 'calls');
  ledger = path.join(tmp, 'ledger');
  fs.mkdirSync(app, { recursive: true });
  fs.mkdirSync(bin);
  git('init', '-q', '-b', 'main');

  write('.gitignore', 'node_modules/\n.env\nuploads/\nlogs/\ndist/\n');
  write('.sequelizerc', "module.exports = { config: 'src/config/sequelize.js' };\n");
  write('package.json', '{ "name": "episode-metadata" }\n');
  write('src/config/sequelize.js', "require('dotenv'); module.exports = {};\n");
  write('src/migrations/20261026000001-add-a.js', 'module.exports = { up() {} }; // a\n');
  write('src/models/x.js', 'old model\n');
  write('scripts/check-pending-migrations.js', CHECK);
  write('docs/notes.md', 'not staged\n');
  OLD = commit('old');
  write('src/migrations/20261026000002-add-b.js', 'module.exports = { up() {} }; // b at target\n');
  write('src/models/x.js', 'new model, needs b\n');
  TARGET = commit('target');
  git('update-ref', 'refs/remotes/origin/main', TARGET);
  // A commit after the target that changes a package file, also on origin/main.
  write('package.json', '{ "name": "episode-metadata", "dependencies": { "x": "1" } }\n');
  PKG = commit('package change');
  git('update-ref', 'refs/remotes/origin/main', PKG);
  // A commit that is not on origin/main.
  git('checkout', '-q', '-b', 'side', OLD);
  write('src/models/x.js', 'side\n');
  SIDE = commit('side');
  git('checkout', '-q', '--detach', OLD);
  git('branch', '-q', '-D', 'side');
  git('update-ref', 'refs/heads/main', OLD);
  git('checkout', '-q', 'main');

  // What the box keeps outside git: none of it may change.
  write('.env', 'LIVE_ENV_MARKER=1\n');
  write('uploads/portraits/p.png', 'png');
  write('logs/out.log', 'log line\n');
  write('frontend/dist/index.html', 'live build');
  write('node_modules/sequelize/package.json', '{ "name": "sequelize", "main": "index.js" }\n');
  write('node_modules/sequelize/index.js', 'module.exports = {};\n');
  write('node_modules/.bin/sequelize-cli', CLI, 0o755);

  fs.writeFileSync(path.join(home, '.episode-migrate.env'), 'DB_USER=migrator\nDB_PASSWORD=pw\n', { mode: 0o600 });
  // stat: the box's ubuntu owner (the tests may run as another user).
  fs.writeFileSync(path.join(bin, 'stat'), '#!/usr/bin/env bash\necho "600 ubuntu"\n', { mode: 0o755 });
});
afterEach(() => {
  // Staged releases are read-only; give directories write back (links are not followed) so they can go.
  spawnSync('find', [tmp, '-type', 'd', '-exec', 'chmod', 'u+w', '{}', '+']);
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** The live app directory, file by file (content and mtime), plus HEAD and status. */
function snapshot() {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      const rel = path.relative(app, p);
      if (rel === '.git') continue;
      if (e.isSymbolicLink()) out.push(`L ${rel} -> ${fs.readlinkSync(p)}`);
      else if (e.isDirectory()) { out.push(`D ${rel}`); walk(p); }
      else out.push(`F ${rel} ${sha(fs.readFileSync(p))} ${fs.statSync(p).mtimeMs}`);
    }
  })(app);
  out.push(`HEAD ${git('rev-parse', 'HEAD')}`, `STATUS ${git('status', '--porcelain', '--untracked-files=all')}`);
  return out.join('\n');
}

/** Runs one phase (or any body) with the named functions, as the box would. */
function run(body, { fns = MIGRATE_FNS, target = TARGET, env = {} } = {}) {
  const res = spawnSync('bash', ['-c', [
    'set -euo pipefail',
    fns.map(fn).join('\n'),
    `PHASE=migrate; TARGET=${target}; APP_DIR="${app}"; export PHASE_PID=$$`,
    'API_APP=episode-api-prod-hotfix; WORKER_APP=episode-worker; HEALTH_URL=http://localhost:3000/health',
    'MIGRATE_ENV="$HOME/.episode-migrate.env"; DEPLOY_MIGRATED="$HOME/.episode-deploy-migrated"',
    'DEPLOY_MARKER="$HOME/.episode-deploy-unfinished"; STAGE_ROOT="$HOME/.episode-stage"',
    STAGE_PATHS_LINE,
    LOCK_TIMEOUT_LINE,
    VOICE_WORKER_LINE,
    BACKUP_KEEP_LINE,
    'cd "$APP_DIR"',
    body,
  ].join('\n')], {
    env: {
      PATH: `${bin}:${process.env.PATH}`, HOME: home, CALLS: calls, LEDGER: ledger, LIVE_APP: app,
      PROC_ROOT: path.join(tmp, 'proc'), ...GIT_ENV, ...env,
    },
    encoding: 'utf8',
  });
  return {
    status: res.status, out: res.stdout, err: res.stderr,
    calls: fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8') : '',
  };
}
const migrate = (opts) => run('phase_migrate', opts);
const stage = (t = TARGET) => path.join(home, '.episode-stage', t);
const migrated = () => {
  const p = path.join(home, '.episode-deploy-migrated');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null;
};

describe('the migrate phase runs from the staged target; the live directory never changes', () => {
  test('pending files: migrated from the staged release with the live .env and node_modules, then recorded; the stage stays, read-only', () => {
    fs.writeFileSync(ledger, '20261026000001-add-a.js\n');
    const before = snapshot();
    const res = migrate();
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    expect(res.out).toMatch(/^MIGRATE_RAN=1$/m);

    // It ran from the stage, pointed explicitly at the stage's config and migrations.
    const s = stage();
    expect(res.calls).toContain(`cli cwd=${s}\n`);
    expect(res.calls).toContain(`cli args=db:migrate --config ${s}/src/config/sequelize.js --migrations-path ${s}/src/migrations\n`);
    // With the live .env and node_modules (links, not copies), the migration user and NODE_ENV.
    expect(res.calls).toContain(`cli env=LIVE_ENV_MARKER=1 link=${app}/.env modules=${app}/node_modules node_env=production user=migrator\n`);
    // Every lock it takes is waited for at most 30 s (Deploy run 176), and the log says so.
    expect(res.calls).toContain('cli pgoptions=-c lock_timeout=30s\n');
    expect(res.out).toContain('lock_timeout 30s');
    // The ledger was checked from the stage, before and after.
    expect(res.calls.match(new RegExp(`^check cwd=${s} env=LIVE_ENV_MARKER=1$`, 'gm'))).toHaveLength(2);
    // Node, started in the stage, resolved the staged config and the live .env and sequelize.
    expect(res.out).toContain(`STAGE_CONFIG=${s}/src/config/sequelize.js`);
    expect(res.out).toContain(`STAGE_MIGRATIONS=${s}/src/migrations`);
    expect(res.out).toContain(`STAGE_DOTENV=${app}/.env`);
    expect(res.out).toContain(`STAGE_SEQUELIZE=${app}/node_modules/sequelize/index.js`);

    // While it migrated, the live tree was still the old commit.
    expect(res.calls).toContain(`cli live_head=${OLD}\n`);
    // Afterwards nothing in the live directory changed: tree, .env, uploads, logs, dist, node_modules.
    expect(snapshot()).toBe(before);
    expect(migrated()).toBe(TARGET);
    // Kept for the deploy and restart phases, read-only: no write bit on any file or directory.
    expect(fs.readdirSync(path.join(home, '.episode-stage'))).toEqual([TARGET]);
    const writable = spawnSync('find', [s, '(', '-type', 'f', '-o', '-type', 'd', ')', '-perm', '/222'], { encoding: 'utf8' }).stdout;
    expect(writable).toBe('');
    // The links' targets keep their own modes.
    expect(fs.statSync(path.join(app, '.env')).mode & 0o200).toBe(0o200);
    expect(fs.readFileSync(path.join(app, '.env'), 'utf8')).toBe('LIVE_ENV_MARKER=1\n');
    expect(fs.existsSync(path.join(app, 'node_modules', '.bin', 'sequelize-cli'))).toBe(true);
  });

  test('the staged files are the target commit\'s, not the live tree\'s', () => {
    const res = migrate();
    expect(res.status).toBe(0);
    expect(res.calls).toContain('cli b=module.exports = { up() {} }; // b at target model=new model, needs b\n');
    expect(res.out).toMatch(new RegExp(`Staged ${TARGET} at ~/\\.episode-stage/${TARGET}: 7 files, each matching the commit\\.`));
    // Only STAGE_PATHS and the two links: no docs/, no .gitignore, no copy of .env.
    expect(res.calls).toContain('cli staged=.env .sequelizerc node_modules package.json scripts src \n');
  });

  test('nothing pending: no migration runs, the target is still recorded', () => {
    fs.writeFileSync(ledger, '20261026000001-add-a.js\n20261026000002-add-b.js\n');
    const before = snapshot();
    const res = migrate();
    expect(res.status).toBe(0);
    expect(res.out).toMatch(/^MIGRATE_RAN=0$/m);
    expect(res.calls).not.toContain('cli ');
    expect(migrated()).toBe(TARGET);
    expect(snapshot()).toBe(before);
  });

  test('a box already at the target (a resumed run) migrates from the stage just the same', () => {
    git('merge', '-q', '--ff-only', TARGET);
    const res = migrate();
    expect(res.status).toBe(0);
    expect(res.calls).toContain(`cli cwd=${stage()}\n`);
    expect(migrated()).toBe(TARGET);
  });
});

describe('a failed migration leaves the live directory unchanged and blocks the deploy phase', () => {
  test('db:migrate fails: stops, records nothing, undoes nothing, keeps the stage for diagnosis', () => {
    // An earlier attempt's record for the same target must not survive.
    fs.writeFileSync(path.join(home, '.episode-deploy-migrated'), `${TARGET}\n`);
    const before = snapshot();
    const res = migrate({ env: { STUB_MIGRATE: 'fail' } });
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/STOPPED \(migrate\): db:migrate exited 1\./);
    expect(res.err).toContain('Nothing is undone or restored automatically');
    expect(res.err).toContain(`The live tree (${OLD}) and the running API are unchanged, and the deploy phase will refuse to run.`);
    expect(migrated()).toBeNull();
    expect(snapshot()).toBe(before);
    expect(fs.existsSync(stage())).toBe(true);
    expect(res.out).not.toMatch(/MIGRATE_RAN/);

    // The deploy phase then refuses before touching anything.
    const deploy = run('PHASE=deploy; phase_deploy', {
      fns: ['die', 'redact', 'require_migrated', 'require_clean_tree', 'build_heap_mb', 'running_vite_builds',
        'memory_lines', 'fetch_artifact', 'install_artifact', 'phase_deploy'],
      env: { ARTIFACT_URL: 'none', ARTIFACT_SHA256: 'none' },
    });
    expect(deploy.status).toBe(1);
    expect(deploy.err).toMatch(new RegExp(`STOPPED \\(deploy\\): the migrate phase has not succeeded for ${TARGET} \\(recorded: nothing\\)\\.`));
    expect(deploy.err).toContain('Nothing was changed');
    expect(snapshot()).toBe(before);
    expect(fs.readdirSync(home).filter((f) => f.startsWith('dist-backup-'))).toEqual([]);
  });

  test('a re-check that is not 0 after db:migrate also stops and records nothing', () => {
    // The stub "migrates" a, but the ledger check then cannot read the ledger.
    const res = run([
      fn('pending_check').replace('pending_check()', 'real_pending_check()'),
      'n=0; pending_check() { n=$((n + 1)); if [ "$n" -eq 2 ]; then PENDING_RC=2; PENDING_FILES=""; else real_pending_check "$@"; fi; }',
      'phase_migrate',
    ].join('\n'));
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/the re-check exited 2, not 0, after db:migrate\./);
    expect(migrated()).toBeNull();
  });

  test('an unreadable ledger stops before any migration', () => {
    const res = migrate({ env: { STUB_LEDGER: '2' } });
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/the pending-migration check exited 2 \(ledger unreadable\)\. No migration was run\./);
    expect(res.calls).not.toContain('cli ');
    expect(migrated()).toBeNull();
  });
});

describe('the target must stay the approved commit', () => {
  test('deploy and restart refuse a record for another commit', () => {
    fs.writeFileSync(path.join(home, '.episode-deploy-migrated'), `${OLD}\n`);
    const res = run('PHASE=deploy; require_migrated', { fns: ['die', 'require_migrated'] });
    expect(res.status).toBe(1);
    expect(res.err).toMatch(new RegExp(`the migrate phase has not succeeded for ${TARGET} \\(recorded: ${OLD}\\)\\.`));
  });

  test('the restart phase refuses before any pm2 call without a matching record', () => {
    git('merge', '-q', '--ff-only', TARGET);
    fs.writeFileSync(path.join(bin, 'pm2'), `#!/usr/bin/env bash\necho "pm2 $*" >>"${calls}"\n`, { mode: 0o755 });
    const res = run('PHASE=restart; phase_restart', {
      fns: ['die', 'redact', 'require_at_target', 'require_migrated', 'pm2_state', 'pm2_status', 'phase_restart'],
    });
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/STOPPED \(restart\): the migrate phase has not succeeded/);
    expect(res.calls).not.toContain('pm2 restart');
  });

  test('a target that is not on origin/main is refused before anything is staged', () => {
    const res = migrate({ target: SIDE });
    expect(res.status).toBe(1);
    expect(res.err).toMatch(new RegExp(`${SIDE} is not on origin/main\\.`));
    expect(fs.existsSync(path.join(home, '.episode-stage'))).toBe(false);
    expect(res.calls).toBe('');
  });

  test('a target the live tree does not fast-forward to is refused', () => {
    git('merge', '-q', '--ff-only', TARGET);
    const res = migrate({ target: OLD });
    expect(res.status).toBe(1);
    expect(res.err).toMatch(new RegExp(`${OLD} is not a fast-forward of the live tree's ${TARGET}\\.`));
    expect(res.calls).toBe('');
  });

  test('a package change between the live tree and the target stops before staging (shared node_modules)', () => {
    const before = snapshot();
    const res = migrate({ target: PKG });
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/package files change between the live tree and/);
    expect(res.err).toContain('package.json');
    expect(res.err).toContain('shares the live node_modules');
    expect(fs.existsSync(path.join(home, '.episode-stage'))).toBe(false);
    expect(res.calls).toBe('');
    expect(snapshot()).toBe(before);
  });

  test('a staged file that differs from the commit, or an extra one, is refused', () => {
    const tamper = (how) => run([
      'stage_release() { mkdir -p "$STAGE_ROOT"; STAGE="$STAGE_ROOT/$TARGET"; rm -rf "$STAGE"; mkdir "$STAGE";',
      '  git archive --format=tar "$TARGET" -- "${STAGE_PATHS[@]}" | tar -x -C "$STAGE";',
      '  ln -s "$APP_DIR/.env" "$STAGE/.env"; ln -s "$APP_DIR/node_modules" "$STAGE/node_modules";',
      `  ${how}; verify_stage; }`,
      'stage_release',
    ].join('\n'));
    const changed = tamper('echo "x" >>"$STAGE/src/models/x.js"');
    expect(changed.status).toBe(1);
    expect(changed.err).toMatch(/the staged release does not hold exactly .* files\./);
    const extra = tamper('echo "x" >"$STAGE/src/migrations/20261026000009-extra.js"');
    expect(extra.status).toBe(1);
    expect(extra.err).toMatch(/does not hold exactly/);
    const ok = tamper('true');
    expect(ok.status).toBe(0);
  });

  test('an .env link that is not the live .env is refused', () => {
    const res = run([
      'mkdir -p "$STAGE_ROOT"; STAGE="$STAGE_ROOT/$TARGET"; mkdir "$STAGE"',
      'git archive --format=tar "$TARGET" -- "${STAGE_PATHS[@]}" | tar -x -C "$STAGE"',
      `echo other >"${tmp}/other.env"; ln -s "${tmp}/other.env" "$STAGE/.env"; ln -s "$APP_DIR/node_modules" "$STAGE/node_modules"`,
      'verify_stage',
    ].join('\n'));
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/\.env or node_modules is not the live one/);
  });
});

describe('staged releases are cleaned up safely', () => {
  const stale = () => {
    const d = path.join(home, '.episode-stage', OLD);
    fs.mkdirSync(path.join(d, 'src'), { recursive: true });
    fs.symlinkSync(path.join(app, '.env'), path.join(d, '.env'));
    fs.symlinkSync(path.join(app, 'node_modules'), path.join(d, 'node_modules'));
    return d;
  };

  test("a leftover stage is removed, its links with it, never what they point to", () => {
    const d = stale();
    const before = snapshot();
    const res = migrate();
    expect(res.status).toBe(0);
    expect(fs.existsSync(d)).toBe(false);
    expect(snapshot()).toBe(before);
    expect(fs.readFileSync(path.join(app, '.env'), 'utf8')).toBe('LIVE_ENV_MARKER=1\n');
    expect(fs.existsSync(path.join(app, 'node_modules', 'sequelize', 'index.js'))).toBe(true);
  });

  test('a leftover stage a process still uses (cwd or an open file) stops the phase and is kept', () => {
    for (const kind of ['cwd', 'fd']) {
      const d = stale();
      const proc = path.join(tmp, 'proc', '4242');
      fs.rmSync(path.join(tmp, 'proc'), { recursive: true, force: true });
      fs.mkdirSync(path.join(proc, 'fd'), { recursive: true });
      if (kind === 'cwd') fs.symlinkSync(d, path.join(proc, 'cwd'));
      else fs.symlinkSync(path.join(d, 'src', 'x.js'), path.join(proc, 'fd', '7'));
      const res = migrate();
      expect(res.status).toBe(1);
      expect(res.out).toContain(`~/.episode-stage/${OLD} is in use (pid 4242); not removed.`);
      expect(res.err).toMatch(/an earlier staged release is still in use/);
      expect(fs.existsSync(d)).toBe(true);
      expect(res.calls).not.toContain('cli ');
      fs.rmSync(path.join(tmp, 'proc'), { recursive: true, force: true });
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  test('anything else in the stage root is left alone, and nothing outside it is ever removed', () => {
    fs.mkdirSync(path.join(home, '.episode-stage', 'keep-me'), { recursive: true });
    const res = migrate();
    expect(res.status).toBe(0);
    expect(res.out).toContain('Left alone, not a staged release: ~/.episode-stage/keep-me');
    expect(fs.existsSync(path.join(home, '.episode-stage', 'keep-me'))).toBe(true);
    for (const target of ['"$APP_DIR"', '"$STAGE_ROOT/../episode-metadata"', '"$STAGE_ROOT/keep-me"', '"$STAGE_ROOT"', `"$STAGE_ROOT/${TARGET}/../.."`]) {
      const outside = run(`remove_stage ${target}`, { fns: ['die', 'processes_using', 'remove_stage'] });
      expect(outside.status).toBe(1);
      expect(outside.err).toMatch(/refusing to remove .*: it is not a staged release in/);
    }
    expect(fs.existsSync(path.join(app, '.env'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.episode-stage', 'keep-me'))).toBe(true);
  });

  test('links planted in a leftover stage are removed as links: nothing live is followed, changed or deleted', () => {
    const root = path.join(home, '.episode-stage');
    // A leftover stage holding links into the live app, a read-only directory, and a stage that is itself a link.
    const d = path.join(root, OLD);
    fs.mkdirSync(path.join(d, 'src', 'deep'), { recursive: true });
    fs.symlinkSync(app, path.join(d, 'src', 'app'));
    fs.symlinkSync(path.join(app, 'uploads'), path.join(d, 'uploads'));
    fs.symlinkSync(path.join(app, '.env'), path.join(d, '.env'));
    fs.chmodSync(path.join(d, 'src', 'deep'), 0o555);
    fs.chmodSync(path.join(d, 'src'), 0o555);
    fs.symlinkSync(app, path.join(root, SIDE));
    fs.chmodSync(path.join(app, '.env'), 0o600);
    fs.chmodSync(path.join(app, 'uploads'), 0o555);
    const before = snapshot();
    const res = migrate();
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    expect(fs.existsSync(d)).toBe(false);
    expect(fs.existsSync(path.join(root, SIDE))).toBe(false);
    expect(snapshot()).toBe(before);
    expect(fs.statSync(path.join(app, '.env')).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.join(app, 'uploads')).mode & 0o777).toBe(0o555);
    expect(fs.readFileSync(path.join(app, 'uploads', 'portraits', 'p.png'), 'utf8')).toBe('png');
    fs.chmodSync(path.join(app, 'uploads'), 0o755);
  });

  test('a stage root that is a symbolic link is refused', () => {
    fs.mkdirSync(path.join(tmp, 'elsewhere'));
    fs.symlinkSync(path.join(tmp, 'elsewhere'), path.join(home, '.episode-stage'));
    const res = migrate();
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/\.episode-stage is a symbolic link\./);
  });
});

describe('what the migrate record can and cannot authorize', () => {
  const guard = (body = 'PHASE=deploy; require_migrated') => run(body);
  const record = (text) => fs.writeFileSync(path.join(home, '.episode-deploy-migrated'), text);

  test('after a successful migrate the guard passes, reading the ledger from the unchanged staged release', () => {
    expect(migrate().status).toBe(0);
    fs.writeFileSync(calls, '');
    const res = guard();
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    expect(res.out).toMatch(/OK: 0 pending of 2 migration files checked/);
    expect(res.calls).toContain(`check cwd=${stage()} env=LIVE_ENV_MARKER=1\n`);
  });

  test('a record whose database no longer has the migrations (restored since) authorizes nothing', () => {
    expect(migrate().status).toBe(0);
    fs.writeFileSync(ledger, '20261026000001-add-a.js\n');
    const res = guard();
    expect(res.status).toBe(1);
    expect(res.err).toMatch(new RegExp(`the ledger check for ${TARGET} exited 1, not 0\\.`));
    expect(res.err).toContain('Nothing was changed. Start a new run');
  });

  test('an unreadable ledger authorizes nothing', () => {
    expect(migrate().status).toBe(0);
    const res = guard().status;
    expect(res).toBe(0);
    expect(run('PHASE=deploy; require_migrated', { env: { STUB_LEDGER: '2' } }).status).toBe(1);
  });

  test.each([
    ['another commit', () => `${'0'.repeat(40)}\n`],
    ['a truncated SHA', () => TARGET.slice(0, 20)],
    ['the SHA with anything after it', () => `${TARGET}\n${TARGET}\n`],
    ['an empty file', () => ''],
  ])('a record holding %s authorizes nothing', (_, text) => {
    expect(migrate().status).toBe(0);
    record(text());
    const res = guard();
    expect(res.status).toBe(1);
    expect(res.err).toMatch(new RegExp(`the migrate phase has not succeeded for ${TARGET}`));
  });

  test('a record without its staged release authorizes nothing', () => {
    record(`${TARGET}\n`);
    const res = guard();
    expect(res.status).toBe(1);
    expect(res.err).toMatch(new RegExp(`the staged release of ${TARGET} is gone\\.`));
  });

  test('a staged release changed after the migrate phase authorizes nothing', () => {
    expect(migrate().status).toBe(0);
    const f = path.join(stage(), 'src', 'models', 'x.js');
    fs.chmodSync(f, 0o644);
    fs.appendFileSync(f, 'changed\n');
    const res = guard();
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/does not hold exactly/);
  });

  test('an interrupted migration (the phase killed mid-db:migrate) leaves no record, stale or new', () => {
    record(`${TARGET}\n`); // an earlier attempt's success
    const res = migrate({ env: { STUB_MIGRATE: 'kill' } });
    expect(res.status).not.toBe(0);
    expect(res.out).not.toMatch(/MIGRATE_RAN/);
    expect(migrated()).toBeNull();
    expect(fs.existsSync(path.join(home, '.episode-deploy-migrated.new'))).toBe(false);
    expect(guard().status).toBe(1);
  });

  test('retry after Migrate succeeded and Deploy failed: the next migrate re-stages, finds nothing pending and records again', () => {
    fs.writeFileSync(ledger, '20261026000001-add-a.js\n');
    expect(migrate().status).toBe(0);
    // Deploy stopped: nothing on the live tree moved. A new run starts with Migrate.
    const again = migrate();
    expect(again.err).toBe('');
    expect(again.status).toBe(0);
    expect(again.out).toMatch(/^MIGRATE_RAN=0$/m);
    expect(migrated()).toBe(TARGET);
    expect(guard().status).toBe(0);
    // Nothing was rolled back: the ledger kept both migrations.
    expect(fs.readFileSync(ledger, 'utf8')).toBe('20261026000001-add-a.js\n20261026000002-add-b.js\n');
  });

  test('a staged file changed between the check and db:migrate stops before db:migrate runs', () => {
    // The ledger check (run from the stage) changes a staged migration on its first call.
    const res = run([
      fn('pending_check').replace('pending_check()', 'real_pending_check()'),
      'pending_check() {',
      `  if [ ! -e "${tmp}/tampered" ]; then f="$STAGE/src/migrations/20261026000002-add-b.js"; chmod u+w "$f"; echo '// x' >>"$f"; : >"${tmp}/tampered"; fi`,
      '  real_pending_check "$@"',
      '}',
      'phase_migrate',
    ].join('\n'));
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/does not hold exactly/);
    expect(res.calls).not.toContain('cli ');
    expect(migrated()).toBeNull();
  });

  test('a staged file changed during db:migrate is caught after it, and nothing is recorded', () => {
    const res = migrate({ env: { STUB_MIGRATE: 'tamper' } });
    expect(res.status).toBe(1);
    expect(res.out).toMatch(/db:migrate exit 0/);
    expect(res.err).toMatch(/does not hold exactly/);
    expect(migrated()).toBeNull();
  });

  test('a successful restart removes the record and the staged release; nothing live is touched', () => {
    expect(migrate().status).toBe(0);
    git('merge', '-q', '--ff-only', TARGET); // the deploy phase's fast-forward
    fs.writeFileSync(path.join(bin, 'pm2'), `#!/usr/bin/env bash
echo "pm2 $*" >>"${calls}"
if [ "$1" = jlist ]; then echo '[{"name":"episode-api-prod-hotfix","pm2_env":{"status":"online","restart_time":3}},{"name":"episode-worker","pm2_env":{"status":"stopped","restart_time":0}}]'; fi
`, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'curl'), '#!/usr/bin/env bash\necho \'{"status":"healthy","database":"connected"}\'\n', { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
    const before = snapshot();
    const res = run('PHASE=restart; phase_restart', { fns: RESTART_FNS });
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    expect(res.out).toMatch(/^RESTART_OK=1$/m);
    expect(res.calls).toContain('pm2 restart episode-api-prod-hotfix');
    expect(res.calls).not.toContain('pm2 restart episode-worker');
    expect(migrated()).toBeNull();
    expect(fs.existsSync(stage())).toBe(false);
    expect(snapshot()).toBe(before);
  });
});

// Evoni's rulings on Issue #3650 (2026-10-30): Deploy restarts the isolated
// voice worker only if it was already running and never starts a stopped one
// (nor episode-worker); and it keeps only its newest frontend backups, which
// had filled the disk (230 of them, 1.5 GB).
describe('restart: the voice worker, and the frontend backups', () => {
  const flag = () => path.join(tmp, 'voice-restarted');
  const entry = (name, status) => (status === 'missing' ? '' : `{"name":"${name}","pm2_env":{"status":"${status}","restart_time":1}}`);
  function restartWith({ worker = 'stopped', voice = 'online', voiceAfter = 'online' } = {}) {
    expect(migrate().status).toBe(0);
    git('merge', '-q', '--ff-only', TARGET); // the deploy phase's fast-forward
    const api = entry('episode-api-prod-hotfix', 'online');
    const work = entry('episode-worker', worker);
    const before = entry('episode-voice-worker', voice);
    const after = entry('episode-voice-worker', voiceAfter);
    fs.writeFileSync(path.join(bin, 'pm2'), `#!/usr/bin/env bash
echo "pm2 $*" >>"${calls}"
if [ "$1" = restart ] && [ "$2" = episode-voice-worker ]; then touch "${flag()}"; fi
if [ "$1" = jlist ]; then
  if [ -e "${flag()}" ]; then v='${after}'; else v='${before}'; fi
  w='${work}'
  printf '[%s%s%s]\\n' '${api}' "\${w:+,\$w}" "\${v:+,\$v}"
fi
`, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'curl'), '#!/usr/bin/env bash\necho \'{"status":"healthy","database":"connected"}\'\n', { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
    return run('PHASE=restart; phase_restart', { fns: RESTART_FNS });
  }

  test('a voice worker that was online is restarted, after the API is healthy', () => {
    const res = restartWith({ voice: 'online' });
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    expect(res.out).toMatch(/^VOICE_WORKER_BEFORE=online$/m);
    expect(res.out).toMatch(/^VOICE_WORKER_ACTION=restarted$/m);
    expect(res.out).toMatch(/^VOICE_WORKER_AFTER=online$/m);
    const lines = res.calls.split('\n');
    expect(lines.indexOf('pm2 restart episode-voice-worker')).toBeGreaterThan(lines.indexOf('pm2 restart episode-api-prod-hotfix'));
    expect(res.out).toMatch(/^RESTART_OK=1$/m);
  });

  test.each(['stopped', 'missing', 'errored'])('a voice worker that was %s is left exactly as it was (never started)', (state) => {
    const res = restartWith({ voice: state });
    expect(res.status).toBe(0);
    expect(res.out).toMatch(new RegExp(`^VOICE_WORKER_ACTION=left-${state}$`, 'm'));
    expect(res.calls).not.toMatch(/episode-voice-worker/);
    expect(res.calls).not.toMatch(/^pm2 start/m);
  });

  test('episode-worker (paid scene generation) stays stopped while the voice worker is restarted', () => {
    const res = restartWith({ worker: 'stopped', voice: 'online' });
    expect(res.status).toBe(0);
    expect(res.calls).not.toMatch(/episode-worker(\s|$)/);
    expect(res.out).toMatch(/^WORKER_ACTION=left-stopped$/m);
    expect(res.calls).not.toMatch(/^pm2 start/m);
  });

  test('a voice worker that is not online after its restart stops the phase with a plain message; the API stays restarted', () => {
    const res = restartWith({ voice: 'online', voiceAfter: 'errored' });
    expect(res.status).not.toBe(0);
    expect(res.out + res.err).toMatch(/episode-voice-worker is not online after its restart/);
    expect(res.out).toMatch(/^VOICE_WORKER_AFTER=errored$/m);
    expect(res.calls).toContain('pm2 restart episode-api-prod-hotfix');
    expect(res.out).not.toMatch(/^RESTART_OK=1$/m);
  });

  test('after a finished deploy only the newest 3 frontend backups stay, plus the target\'s; links, logs and other files are never touched', () => {
    const names = [
      'dist-backup-20260929T190104Z', // the manual deploy's naming, no commit
      `dist-backup-20261001T000000Z-${TARGET.slice(0, 12)}`, // old, but of the target: kept
      'dist-backup-20261002T000000Z-aaaaaaaaaaaa',
      'dist-backup-20261028T000000Z-bbbbbbbbbbbb',
      'dist-backup-20261029T000000Z-cccccccccccc',
      'dist-backup-20261030T000000Z-dddddddddddd',
    ];
    for (const n of names) {
      fs.mkdirSync(path.join(home, n));
      fs.writeFileSync(path.join(home, n, 'index.html'), n);
    }
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'keep.txt'), 'x');
    fs.symlinkSync(outside, path.join(home, 'dist-backup-20250101T000000Z-link'));
    fs.writeFileSync(path.join(home, 'dist-backup-20260929T190104Z.vite-build.log'), 'log');
    fs.writeFileSync(path.join(home, 'dist-backup-20250101T000000Z-file'), 'a file');

    const res = restartWith({ voice: 'stopped' });
    expect(res.status).toBe(0);
    expect(res.out).toMatch(/^BACKUPS_REMOVED=2$/m);
    const left = fs.readdirSync(home).filter((f) => f.startsWith('dist-backup-')).sort();
    expect(left).toEqual([
      'dist-backup-20250101T000000Z-file',
      'dist-backup-20250101T000000Z-link',
      `dist-backup-20261001T000000Z-${TARGET.slice(0, 12)}`,
      'dist-backup-20260929T190104Z.vite-build.log',
      'dist-backup-20261028T000000Z-bbbbbbbbbbbb',
      'dist-backup-20261029T000000Z-cccccccccccc',
      'dist-backup-20261030T000000Z-dddddddddddd',
    ].sort());
    expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('x');
    expect(res.out.indexOf('BACKUPS_REMOVED=')).toBeLessThan(res.out.indexOf('RESTART_OK=1'));
  });

  test('backups are not pruned when the restart does not finish', () => {
    for (const n of ['20261001', '20261002', '20261003', '20261004', '20261005']) {
      fs.mkdirSync(path.join(home, `dist-backup-${n}T000000Z-eeeeeeeeeeee`));
    }
    const res = restartWith({ voice: 'online', voiceAfter: 'errored' });
    expect(res.status).not.toBe(0);
    expect(fs.readdirSync(home).filter((f) => f.startsWith('dist-backup-'))).toHaveLength(5);
  });

  test('the workflow summary reports the voice worker and the backups', () => {
    expect(WORKFLOW).toMatch(/voice_worker_action=\$\(wstate VOICE_WORKER_ACTION\)/);
    expect(WORKFLOW).toMatch(/\| Voice worker \|/);
    expect(WORKFLOW).toMatch(/backups_removed=/);
  });
});

describe('the phases, as written', () => {
  const phase = (name) => fn(`phase_${name}`);

  test('the whole script parses (bash -n, nothing run)', () => {
    const res = spawnSync('bash', ['-n'], { input: SCRIPT_TEXT, encoding: 'utf8' });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  test('migrate never moves the live tree or restarts anything', () => {
    const m = phase('migrate') + fn('stage_release') + fn('verify_stage') + fn('finish_migrate') + fn('clean_stages');
    expect(m).not.toMatch(/git (merge|reset|checkout|pull|switch|stash|clean)(?![-\w])/);
    expect(m).not.toMatch(/\bpm2\b|npx /);
    // Its own record goes first, so a failure never leaves one behind.
    expect(phase('migrate')).toMatch(/^phase_migrate\(\) \{\n(\s*#.*\n)*\s*rm -f "\$DEPLOY_MIGRATED" "\$DEPLOY_MIGRATED\.new"\n/);
  });

  test('deploy checks the record before anything else; restart before any pm2 call; restart clears it last', () => {
    expect(phase('deploy')).toMatch(/^phase_deploy\(\) \{\n\s+require_migrated\n/);
    const restart = phase('restart');
    expect(restart.indexOf('require_migrated')).toBeGreaterThan(0);
    expect(restart.indexOf('require_migrated')).toBeLessThan(restart.indexOf('pm2'));
    expect(restart.indexOf('rm -f "$DEPLOY_MARKER" "$DEPLOY_MIGRATED"')).toBeGreaterThan(restart.lastIndexOf('die '));
  });

  test('nothing undoes a migration or restores a snapshot automatically', () => {
    for (const text of [SCRIPT_TEXT, WORKFLOW]) {
      expect(text).not.toMatch(/db:migrate:undo|restore-db-instance|restore-db-cluster|migrate:undo/);
    }
  });
});

describe('deploy.yml: Migrate before Deploy, Restart last', () => {
  const at = (s) => {
    const i = WORKFLOW.indexOf(s);
    if (i < 0) throw new Error(`not in deploy.yml: ${s}`);
    return i;
  };

  test('snapshot -> Migrate -> frontend hand-off -> Deploy -> Restart -> public health', () => {
    const order = [
      at('- name: Wait for the snapshot to be available'),
      at('bash scripts/deploy/ssm-phase.sh migrate'),
      at("- name: Fetch the runner's frontend build"),
      at('- name: Hand the frontend build to the box'),
      at('run: bash scripts/deploy/ssm-phase.sh deploy'),
      at('bash scripts/deploy/ssm-phase.sh restart'),
      at('- name: Public health check'),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(WORKFLOW.match(/ssm-phase\.sh (migrate|deploy|restart)/g)).toEqual([
      'ssm-phase.sh migrate', 'ssm-phase.sh deploy', 'ssm-phase.sh restart',
    ]);
  });

  test('Deploy runs only when Migrate succeeded; no box step runs after a failure', () => {
    const deployStep = WORKFLOW.slice(at('- name: Deploy (fast-forward and the frontend, on the box)'), at('run: bash scripts/deploy/ssm-phase.sh deploy'));
    expect(deployStep).toContain("if: steps.migrate.outcome == 'success'");
    const boxSteps = WORKFLOW.slice(at('bash scripts/deploy/ssm-phase.sh migrate') - 400, at('- name: Public health check'));
    expect(boxSteps).not.toMatch(/always\(\)|continue-on-error|failure\(\)/);
  });

  test('every phase gets the one TARGET_SHA of the run', () => {
    expect(WORKFLOW).toContain('      TARGET_SHA: ${{ github.sha }}\n');
    // Set once, from the run's commit; no step redefines it.
    expect(WORKFLOW.match(/^\s+TARGET_SHA:/gm)).toHaveLength(1);
    expect(WORKFLOW).not.toMatch(/TARGET_SHA=/);
  });

  test('the runbook describes the new order and the recovery', () => {
    expect(RUNBOOK).toMatch(/\*\*Migrate\*\*, from a staged copy of the commit/);
    expect(RUNBOOK).toContain('Migrate succeeded, Deploy or Restart did not');
    expect(RUNBOOK).toContain('Never run the migration\'s `down`');
  });
});

describe('a migration that cannot get its lock stops at the lock timeout, not at the SSM timeout (Deploy run 176)', () => {
  test('lock timeout: stops with its own message and records nothing, so the deploy phase refuses', () => {
    fs.writeFileSync(ledger, '20261026000001-add-a.js\n');
    fs.rmSync(path.join(home, '.episode-deploy-migrated'), { force: true });
    const before = snapshot();
    const res = migrate({ env: { STUB_MIGRATE: 'lock' } });
    expect(res.status).toBe(1);
    expect(res.out).toContain('ERROR: canceling statement due to lock timeout');
    expect(res.err).toMatch(/STOPPED \(migrate\): db:migrate exited 1: a migration waited more than 30s for a lock/);
    expect(res.err).toContain('Find what holds the lock (docs/runbooks/deploy-workflow.md §4, row "Migrate")');
    expect(res.err).not.toMatch(/STOPPED \(migrate\): db:migrate exited 1\.$/m);
    expect(migrated()).toBeNull();
    expect(snapshot()).toBe(before);
    expect(res.out).not.toMatch(/MIGRATE_RAN/);
  });

  test('the runbook names the lock timeout and how to find what holds the lock', () => {
    expect(RUNBOOK).toContain('lock_timeout');
    expect(RUNBOOK).toContain('pg_stat_activity');
  });
});
