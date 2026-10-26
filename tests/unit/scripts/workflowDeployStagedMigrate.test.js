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

const MIGRATE_FNS = ['die', 'redact', 'require_clean_tree', 'pending_check', 'processes_using', 'remove_stage',
  'clean_stages', 'stage_release', 'verify_stage', 'finish_migrate', 'phase_migrate'];

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
  echo "cli live_head=$(git -C "$LIVE_APP" rev-parse HEAD)"
  echo "cli b=$(tr -d '\\n' <"$mig/20261026000002-add-b.js") model=$(tr -d '\\n' <src/models/x.js)"
  echo "cli staged=$(find . -mindepth 1 -maxdepth 1 -printf '%P ' | tr ' ' '\\n' | sort | tr '\\n' ' ')"
} >>"$CALLS"
if [ "\${STUB_MIGRATE:-ok}" = "fail" ]; then echo 'ERROR: column "b" of relation "episodes" already exists'; exit 1; fi
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
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

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
    `PHASE=migrate; TARGET=${target}; APP_DIR="${app}"`,
    'MIGRATE_ENV="$HOME/.episode-migrate.env"; DEPLOY_MIGRATED="$HOME/.episode-deploy-migrated"',
    'DEPLOY_MARKER="$HOME/.episode-deploy-unfinished"; STAGE_ROOT="$HOME/.episode-stage"',
    STAGE_PATHS_LINE,
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
  test('pending files: migrated from the staged release with the live .env and node_modules, then recorded and cleaned up', () => {
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
    expect(fs.existsSync(s)).toBe(false);
    expect(fs.readdirSync(path.join(home, '.episode-stage'))).toEqual([]);
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

  test('nothing pending: no migration runs, the target is still recorded and the stage removed', () => {
    fs.writeFileSync(ledger, '20261026000001-add-a.js\n20261026000002-add-b.js\n');
    const before = snapshot();
    const res = migrate();
    expect(res.status).toBe(0);
    expect(res.out).toMatch(/^MIGRATE_RAN=0$/m);
    expect(res.calls).not.toContain('cli ');
    expect(migrated()).toBe(TARGET);
    expect(fs.existsSync(stage())).toBe(false);
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
    const outside = run('remove_stage "$APP_DIR"', { fns: ['die', 'processes_using', 'remove_stage'] });
    expect(outside.status).toBe(1);
    expect(outside.err).toMatch(/refusing to remove .*: it is not under/);
    expect(fs.existsSync(path.join(app, '.env'))).toBe(true);
  });

  test('a stage root that is a symbolic link is refused', () => {
    fs.mkdirSync(path.join(tmp, 'elsewhere'));
    fs.symlinkSync(path.join(tmp, 'elsewhere'), path.join(home, '.episode-stage'));
    const res = migrate();
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/\.episode-stage is a symbolic link\./);
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
    expect(phase('migrate')).toMatch(/^phase_migrate\(\) \{\n(\s*#.*\n)*\s*rm -f "\$DEPLOY_MIGRATED"\n/);
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
