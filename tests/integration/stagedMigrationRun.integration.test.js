/**
 * Deploy safety PR 1 (Evoni, 2026-10-26), against Postgres: every migration
 * in the tree runs from a staged release exactly as the Deploy workflow's
 * migrate phase builds it (scripts/deploy/workflow-deploy.sh stage_release:
 * git archive of STAGE_PATHS, links to the live .env and node_modules) and
 * runs it (sequelize-cli with explicit --config and --migrations-path, from
 * the stage). Includes the migrations that require application code
 * (services, utils, constants). Into a fresh database created and dropped
 * here, with the connection coming only from the linked .env. No production
 * host, credential or database.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT_TEXT = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy', 'workflow-deploy.sh'), 'utf8');
// STAGE_PATHS=(.sequelizerc package.json src ...) -> the paths, as the script stages them.
const STAGE_PATHS = /^STAGE_PATHS=\((.*)\)$/m.exec(SCRIPT_TEXT)[1].trim().split(/\s+/);

const baseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const shouldSkip =
  !baseUrl ||
  baseUrl.includes('amazonaws.com') ||
  !baseUrl.includes('episode_metadata_test');

const DB = `stage_check_${process.pid}_${Date.now()}`;
const urlFor = (db) => { const u = new URL(baseUrl); u.pathname = `/${db}`; return u.toString(); };
const admin = async (sql) => {
  const c = new Client({ connectionString: baseUrl });
  await c.connect();
  try { return await c.query(sql); } finally { await c.end(); }
};

(shouldSkip ? describe.skip : describe)('every migration runs from a staged release (deploy safety)', () => {
  let tmp; let stage;

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'staged-migrations-'));
    stage = path.join(tmp, 'stage');
    const live = path.join(tmp, 'live');
    fs.mkdirSync(stage);
    fs.mkdirSync(live);
    const archive = spawnSync('bash', ['-c', 'git archive --format=tar HEAD -- "$@" | tar -x -C "$STAGE"', 'stage', ...STAGE_PATHS],
      { cwd: ROOT, env: { ...process.env, STAGE: stage }, encoding: 'utf8' });
    if (archive.status !== 0) throw new Error(`git archive: ${archive.stderr}`);
    // The "live" .env names the fresh database; the stage links to it, as on the box.
    fs.writeFileSync(path.join(live, '.env'), `TEST_DATABASE_URL=${urlFor(DB)}\n`);
    fs.symlinkSync(path.join(live, '.env'), path.join(stage, '.env'));
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(stage, 'node_modules'));
    await admin(`CREATE DATABASE "${DB}"`);
  }, 60000);

  afterAll(async () => {
    await admin(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  // No DATABASE_URL or TEST_DATABASE_URL: the connection comes from the linked .env alone, as on the box.
  const childEnv = () => ({ PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test' });

  it('db:migrate from the stage applies every migration file, and the ledger check from the stage agrees', () => {
    const files = fs.readdirSync(path.join(stage, 'src', 'migrations')).filter((f) => f.endsWith('.js'));
    expect(files.length).toBeGreaterThan(300);

    const res = spawnSync(path.join(stage, 'node_modules', '.bin', 'sequelize-cli'), [
      'db:migrate', '--config', path.join(stage, 'src', 'config', 'sequelize.js'),
      '--migrations-path', path.join(stage, 'src', 'migrations'),
    ], { cwd: stage, env: childEnv(), encoding: 'utf8', timeout: 300000 });
    const out = `${res.stdout}\n${res.stderr}`;
    if (res.status !== 0) throw new Error(`db:migrate exited ${res.status}:\n${out.slice(-4000)}`);
    expect(out).toContain('Loaded configuration file "src/config/sequelize.js".');
    expect(out.match(/: migrated \(/g)).toHaveLength(files.length);

    const check = spawnSync('node', ['scripts/check-pending-migrations.js'], { cwd: stage, env: childEnv(), encoding: 'utf8', timeout: 60000 });
    expect(check.stdout).toContain(`OK: 0 pending of ${files.length} migration files checked.`);
    expect(check.status).toBe(0);
  }, 360000);

  it('the fresh database holds the ledger and the newest schema (A1b columns)', async () => {
    const c = new Client({ connectionString: urlFor(DB) });
    await c.connect();
    try {
      const files = fs.readdirSync(path.join(stage, 'src', 'migrations')).filter((f) => f.endsWith('.js'));
      const { rows: [{ n }] } = await c.query('SELECT count(*)::int AS n FROM "SequelizeMeta"');
      expect(n).toBe(files.length);
      const { rows } = await c.query(`SELECT table_name FROM information_schema.columns
        WHERE column_name = 'script_line_keys' AND table_schema = current_schema() ORDER BY table_name`);
      expect(rows.map((r) => r.table_name)).toEqual(['episode_script_versions', 'episodes']);
    } finally {
      await c.end();
    }
  });
});
