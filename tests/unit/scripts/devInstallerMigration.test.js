/**
 * The dev installer must not activate a commit whose migrations failed
 * (Evoni, 2026-11-11). Before this, install-dev-app.sh ran db:migrate in a
 * step whose exit status was always 0: a failed migration printed its ERROR
 * line and "pending after: 1", the trees were swapped, the app started, and
 * /health (which knows nothing about migrations) could turn the run green.
 *
 * Now the step is scripts/dev-db/migrate-local-db.sh, run on the staged tree
 * before the swap, and the installer stops when it exits non-zero.
 *
 *   1. migrate-local-db.sh itself, run for real with a stand-in ledger check
 *      and a stand-in npx: success, failure, still pending, unreadable ledger.
 *   2. The installer's own migration and swap steps, lifted from the file and
 *      run against scratch directories: a failed migration swaps nothing.
 *   3. The scripts that act on that failure, by their text.
 *
 * No database, no network, no root.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const MIGRATE = path.join(ROOT, 'scripts/dev-db/migrate-local-db.sh');
const INSTALLER = path.join(ROOT, 'scripts/dev-db/install-dev-app.sh');
const DEPLOY_BOX = path.join(ROOT, 'scripts/dev-db/deploy-dev-box.sh');
const WORKFLOW = path.join(ROOT, '.github/workflows/deploy-dev.yml');

const PENDING_FILE = '20991231235959-a-test-migration.js';

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-installer-migration-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

/**
 * A stand-in app tree. Its ledger check reads the pending count from a state
 * file (or exits 2 when the file says "unreadable"), printing what the real
 * scripts/check-pending-migrations.js prints, target line included. Its npx
 * does what `migrate` says: 'ok' applies everything, 'fail' exits 1 with a
 * sequelize ERROR line, 'noop' exits 0 and applies nothing.
 */
function makeTree(dir, { pending = 0, migrate = 'ok', host = '127.0.0.1' } = {}) {
  fs.mkdirSync(path.join(dir, 'scripts/dev-db'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.copyFileSync(MIGRATE, path.join(dir, 'scripts/dev-db/migrate-local-db.sh'));
  fs.writeFileSync(path.join(dir, 'state'), String(pending));
  fs.writeFileSync(path.join(dir, 'scripts/check-pending-migrations.js'), `
    const fs = require('fs'); const path = require('path');
    const state = fs.readFileSync(path.join(__dirname, '..', 'state'), 'utf8').trim();
    fs.appendFileSync(path.join(__dirname, '..', 'calls'), 'ledger NODE_ENV=' + process.env.NODE_ENV + '\\n');
    console.log('[pending-migrations] reading NODE_ENV=development -> db.internal.example:5432/episode_metadata as episode_dev');
    if (state === 'unreadable') { console.error('[pending-migrations] ERROR: could not read "SequelizeMeta": connect ECONNREFUSED'); process.exit(2); }
    const n = Number(state);
    if (n === 0) { console.log('[pending-migrations] OK: 0 pending of 404 migration files checked.'); process.exit(0); }
    console.log('[pending-migrations] ' + n + ' pending of 404 migration files checked (run order):');
    console.log('  ${PENDING_FILE}');
    console.log('[pending-migrations] FAIL: pending migrations. Do not restart.');
    process.exit(1);
  `);
  const npx = {
    ok: `echo "== ${PENDING_FILE.replace('.js', '')}: migrating ======="; echo "password=hunter2 from a careless migration"; echo "== ${PENDING_FILE.replace('.js', '')}: migrated (0.011s)"; echo 0 > "$TREE_DIR/state"; exit 0`,
    fail: `echo "== ${PENDING_FILE.replace('.js', '')}: migrating ======="; echo "ERROR: [migration] refused, nothing changed: 1 episode(s) are in more than one live season slot."; exit 1`,
    noop: 'echo "No migrations were executed, database schema was already up to date."; exit 0',
  }[migrate];
  fs.writeFileSync(path.join(dir, 'bin/npx'), `#!/usr/bin/env bash\necho "npx $* NODE_ENV=$NODE_ENV" >> "$TREE_DIR/calls"\n${npx}\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'dev.env'), `DB_HOST=${host}\nDB_NAME=episode_metadata\nNODE_ENV=production\n`);
  return dir;
}
const calls = (dir) => (fs.existsSync(path.join(dir, 'calls')) ? fs.readFileSync(path.join(dir, 'calls'), 'utf8').trim().split('\n') : []);
const envFor = (dir) => ({ ...process.env, TREE_DIR: dir, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}` });
function runMigrate(dir, args) {
  const r = spawnSync('bash', [path.join(dir, 'scripts/dev-db/migrate-local-db.sh'), ...(args || [dir, path.join(dir, 'dev.env')])],
    { env: envFor(dir), encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('migrate-local-db.sh: the exit code tells the truth about the migration', () => {
  test('nothing pending: exit 0, and db:migrate is not run', () => {
    const dir = makeTree(path.join(tmp, 'tree'), { pending: 0 });
    const r = runMigrate(dir);
    expect(r.status).toBe(0);
    expect(r.out).toContain('pending before: 0');
    expect(r.out).toContain('MIGRATIONS OK: nothing pending; no migration run.');
    expect(calls(dir)).toEqual(['ledger NODE_ENV=development']);
  });

  test('a successful migration: exit 0 only after the ledger reads clean again', () => {
    const dir = makeTree(path.join(tmp, 'tree'), { pending: 1, migrate: 'ok' });
    const r = runMigrate(dir);
    expect(r.status).toBe(0);
    expect(r.out).toContain('pending before: 1');
    expect(r.out).toContain(`  pending: ${PENDING_FILE}`);
    expect(r.out).toMatch(/== 20991231235959-a-test-migration: migrated \(0\.011s\)/);
    expect(r.out).toContain('db:migrate exit 0');
    expect(r.out).toContain('pending after: 0');
    expect(r.out).toContain('MIGRATIONS OK: db:migrate exited 0 and nothing is pending.');
    expect(calls(dir)).toEqual(['ledger NODE_ENV=development', 'npx sequelize db:migrate NODE_ENV=development', 'ledger NODE_ENV=development']);
  });

  test('a failed migration: exit 1, with sequelize\'s ERROR line and what is still pending', () => {
    const dir = makeTree(path.join(tmp, 'tree'), { pending: 1, migrate: 'fail' });
    const r = runMigrate(dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain('ERROR: [migration] refused, nothing changed: 1 episode(s) are in more than one live season slot.');
    expect(r.out).toContain('db:migrate exit 1');
    expect(r.out).toContain('pending after: 1');
    expect(r.out).toContain('MIGRATION FAILED: db:migrate exited 1.');
    expect(r.out).not.toContain('MIGRATIONS OK');
  });

  test('db:migrate exits 0 but a file is still pending: exit 1', () => {
    const dir = makeTree(path.join(tmp, 'tree'), { pending: 1, migrate: 'noop' });
    const r = runMigrate(dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain('db:migrate exit 0');
    expect(r.out).toContain('pending after: 1');
    expect(r.out).toContain(`  still pending: ${PENDING_FILE}`);
    expect(r.out).toContain('MIGRATION INCOMPLETE: db:migrate exited 0 but the ledger is not clean afterwards.');
    expect(r.out).not.toContain('MIGRATIONS OK');
  });

  test('a ledger that cannot be read is never "nothing pending": exit 1, and db:migrate is not run', () => {
    const dir = makeTree(path.join(tmp, 'tree'), { pending: 'unreadable' });
    const r = runMigrate(dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain('MIGRATION FAILED: the migration ledger could not be read (check exit 2). No migration was run.');
    expect(calls(dir)).toEqual(['ledger NODE_ENV=development']);
  });

  test('a database that is not local is refused before anything is read: exit 2', () => {
    const dir = makeTree(path.join(tmp, 'tree'), { pending: 1, host: 'prod.cluster.example' });
    const r = runMigrate(dir);
    expect(r.status).toBe(2);
    expect(r.out).toContain('MIGRATION REFUSED: DB_HOST is not local.');
    expect(calls(dir)).toEqual([]);
    expect(runMigrate(dir, []).status).toBe(2);
  });

  test('the log shows file names, sequelize\'s "==" and ERROR lines and counts: no host, no other migration output', () => {
    for (const migrate of ['ok', 'fail', 'noop']) {
      const dir = makeTree(path.join(tmp, `tree-${migrate}`), { pending: 1, migrate });
      const { out } = runMigrate(dir);
      expect(out).not.toContain('db.internal.example');
      expect(out).not.toContain('hunter2');
      expect(out).not.toContain('episode_dev');
    }
  });
});

describe('install-dev-app.sh: a failed migration activates nothing', () => {
  const installer = fs.readFileSync(INSTALLER, 'utf8');
  const from = installer.indexOf('step "pending migrations against the LOCAL database"');
  const steps = installer.slice(from);

  /** The installer's own text from the migration step to its end, run on scratch directories. */
  function runInstallerTail({ pending, migrate }) {
    const home = path.join(tmp, 'home');
    const stage = makeTree(path.join(home, 'episode-metadata.next'), { pending, migrate });
    for (const [name, marker] of [['episode-metadata', 'LIVE'], ['episode-metadata.prev', 'ROLLBACK']]) {
      fs.mkdirSync(path.join(home, name), { recursive: true });
      fs.writeFileSync(path.join(home, name, 'marker'), marker);
    }
    const harness = path.join(tmp, 'harness.sh');
    fs.writeFileSync(harness, [
      'set -euo pipefail',
      `APP_USER=tester; HOME_DIR='${home}'; APP_DIR="$HOME_DIR/episode-metadata"; STAGE="$HOME_DIR/episode-metadata.next"; PREV="$HOME_DIR/episode-metadata.prev"`,
      `DEV_ENV="$STAGE/dev.env"; REF=${'a'.repeat(40)}`,
      'step() { echo "== $*"; }',
      'as_app() { bash -c "$1"; }',
      'free() { echo "n/a"; }',
      steps,
    ].join('\n'));
    const r = spawnSync('bash', [harness], { env: envFor(stage), encoding: 'utf8' });
    const marker = (name) => (fs.existsSync(path.join(home, name, 'marker')) ? fs.readFileSync(path.join(home, name, 'marker'), 'utf8') : null);
    return {
      status: r.status, out: r.stdout, err: r.stderr,
      live: marker('episode-metadata'), prev: marker('episode-metadata.prev'),
      liveIsStage: fs.existsSync(path.join(home, 'episode-metadata', 'scripts/dev-db/migrate-local-db.sh')),
      stageKept: fs.existsSync(stage),
    };
  }

  test('the migration step is the last thing before the swap, and nothing in it forgives a failure', () => {
    expect(from).toBeGreaterThan(0);
    const step = steps.slice(0, steps.indexOf('step "swap trees"'));
    expect(steps.indexOf('step "swap trees"')).toBeGreaterThan(0);
    expect(step).toContain("if ! as_app \"bash '$STAGE/scripts/dev-db/migrate-local-db.sh' '$STAGE' '$DEV_ENV'\"; then");
    expect(step).toMatch(/exit 1\nfi\n/);
    expect(step).not.toMatch(/\|\|\s*true/);
    expect(step).not.toMatch(/npx sequelize/); // only migrate-local-db.sh runs sequelize
    expect(installer.match(/migrate-local-db\.sh' '\$STAGE'/g)).toHaveLength(1);
  });

  test('migration failure: exit 1, the live tree and the rollback tree are untouched, the staged tree is not activated', () => {
    const r = runInstallerTail({ pending: 1, migrate: 'fail' });
    expect(r.status).toBe(1);
    expect(r.live).toBe('LIVE');
    expect(r.prev).toBe('ROLLBACK');
    expect(r.liveIsStage).toBe(false);
    expect(r.stageKept).toBe(true);
    expect(r.out).toContain('ERROR: [migration] refused, nothing changed');
    expect(r.out).toContain('== MIGRATION FAILED: aaaaaaaaaaaa is NOT installed.');
    expect(r.err).toContain('MIGRATION FAILED: aaaaaaaaaaaa is not installed; the live tree was not changed');
    expect(r.out).not.toContain('== swap trees');
  });

  test('migrations left pending: exit 1, nothing swapped', () => {
    const r = runInstallerTail({ pending: 1, migrate: 'noop' });
    expect(r.status).toBe(1);
    expect(r.live).toBe('LIVE');
    expect(r.prev).toBe('ROLLBACK');
    expect(r.out).toContain('MIGRATION INCOMPLETE');
    expect(r.out).not.toContain('== swap trees');
  });

  test('an unreadable ledger: exit 1, nothing swapped', () => {
    const r = runInstallerTail({ pending: 'unreadable', migrate: 'ok' });
    expect(r.status).toBe(1);
    expect(r.live).toBe('LIVE');
    expect(r.out).not.toContain('== swap trees');
  });

  test('successful migration: exit 0, the staged tree becomes live and the old live tree becomes the rollback tree', () => {
    const r = runInstallerTail({ pending: 1, migrate: 'ok' });
    expect(r.status).toBe(0);
    expect(r.out).toContain('MIGRATIONS OK: db:migrate exited 0 and nothing is pending.');
    expect(r.out).toContain('== swap trees');
    expect(r.liveIsStage).toBe(true);
    expect(r.prev).toBe('LIVE');
    expect(r.stageKept).toBe(false);
  });

  test('nothing pending: exit 0 and the swap happens', () => {
    const r = runInstallerTail({ pending: 0, migrate: 'ok' });
    expect(r.status).toBe(0);
    expect(r.liveIsStage).toBe(true);
  });

  test('a commit without migrate-local-db.sh is not installed', () => {
    expect(steps).toContain('[ -f "$STAGE/scripts/dev-db/migrate-local-db.sh" ] || {');
  });
});

describe('what acts on the installer\'s failure (unchanged scripts, pinned)', () => {
  test('deploy-dev-box.sh: a failed install restarts the existing tree and exits 1', () => {
    const box = fs.readFileSync(DEPLOY_BOX, 'utf8');
    const failure = box.slice(box.indexOf('if ! REF="$REF"'), box.indexOf('step "start ${REF:0:12}"'));
    expect(failure).toContain('bash "$INSTALLER"; then');
    expect(failure).toContain('if [ -d "$APP_DIR" ]; then echo "   restarting the existing tree"; start_apps; verify || true; fi');
    expect(failure).toMatch(/\n {2}exit 1\nfi/);
    expect(box).toMatch(/^set -euo pipefail$/m);
  });

  test('deploy-dev.yml: the run fails unless the on-box command ended Success, and prints its output either way', () => {
    const yml = fs.readFileSync(WORKFLOW, 'utf8');
    expect(yml).toContain("bash '$D/deploy-dev-box.sh'");
    expect(yml).toMatch(/rc=\\\$\?\s+rm -rf '\$D'\s+exit \\\$rc/);
    expect(yml).toMatch(/if \[ "\$STATUS" != "Success" \]; then[\s\S]*?StandardErrorContent[\s\S]*?exit 1\s+fi/);
    expect(yml).toContain('--query "StandardOutputContent" --output text');
  });
});
