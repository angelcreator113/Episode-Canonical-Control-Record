/**
 * The Deploy workflow's migration session cannot run code another role planted
 * (Evoni, 2026-11-04; docs/reads/2026-11-04-deploy-migration-trusted-path.md).
 *
 * Against a throwaway database and two throwaway roles on the test server,
 * laid out like production:
 *   - `dh_migrator`: the migration login. It owns the database, as postgres
 *     does in production, and is not a superuser.
 *   - `dh_app`: the application login, with production's grants: CREATE on
 *     the database and on public, and the default privileges.
 * The migrations run exactly as phase_migrate runs them: the real
 * sequelize-cli, the repo's src/config/sequelize.js, NODE_ENV=production, the
 * DB_* variables and PGOPTIONS. The trust check is the real
 * scripts/deploy/migration-trust-check.js. The probe migration compares two
 * varchars (which resolves `=` through the search path) and records the
 * search path of its own connection, of a second connection it opens, and of
 * a child process it starts.
 */
const { Client } = require('pg');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = process.env.DATABASE_URL || '';
const shouldSkip = !url || url.includes('amazonaws.com') || !url.includes('episode_metadata_test');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy', 'workflow-deploy.sh'), 'utf8');
const LOCK = /^MIGRATE_LOCK_TIMEOUT=(.*)$/m.exec(SCRIPT)[1];
const SEARCH_PATH = /^MIGRATE_SEARCH_PATH=(.*)$/m.exec(SCRIPT)[1];
const PINNED = `-c lock_timeout=${LOCK} -c search_path=${SEARCH_PATH}`;
const UNPINNED = `-c lock_timeout=${LOCK}`; // what phase_migrate sent before this change

const suffix = crypto.randomBytes(4).toString('hex');
const DB = `dh_trust_${suffix}`;
const MIGRATOR = 'dh_migrator';
const APP = 'dh_app';
const PW = `pw_${suffix}`;

const PROBE = `'use strict';
const { spawnSync } = require('child_process');
module.exports = {
  async up(queryInterface) {
    const s = queryInterface.sequelize;
    await s.query("SELECT 1 WHERE 'a'::varchar = 'a'::varchar");
    const [[own]] = await s.query("SELECT current_setting('search_path') AS p");
    const { Client } = require(${JSON.stringify(require.resolve('pg'))});
    const c = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER,
      password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
    await c.connect();
    const { rows: [second] } = await c.query("SELECT current_setting('search_path') AS p");
    await c.query("SELECT 1 WHERE 'b'::varchar = 'b'::varchar");
    await c.end();
    const child = spawnSync(process.execPath, ['-e', \`
      const { Client } = require(${JSON.stringify(require.resolve('pg'))});
      const c = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
      c.connect().then(() => c.query("SELECT current_setting('search_path') AS p"))
        .then((r) => { process.stdout.write(r.rows[0].p); return c.end(); })
        .catch((e) => { console.error(e.message); process.exit(1); });\`], { encoding: 'utf8' });
    await s.query('CREATE TABLE probe_marker (own text, second text, child text)');
    await s.query('INSERT INTO probe_marker VALUES (:own, :second, :child)',
      { replacements: { own: own.p, second: second.p, child: child.stdout } });
  },
  async down() {},
};
`;

(shouldSkip ? describe.skip : describe)('Deploy migration session: trusted search path', () => {
  let admin; let dir;
  const adminUrl = new URL(url);

  const dbUrl = (user, pw) => {
    const u = new URL(url);
    u.username = user; u.password = pw; u.pathname = `/${DB}`;
    return u.toString();
  };
  const sql = async (connUrl, text) => {
    const c = new Client({ connectionString: connUrl });
    await c.connect();
    try { return await c.query(text); } finally { await c.end(); }
  };
  const asAdmin = (text) => sql(dbUrl(decodeURIComponent(adminUrl.username), decodeURIComponent(adminUrl.password)), text);
  const asApp = (text) => sql(dbUrl(APP, PW), text);
  const asMigrator = (text) => sql(dbUrl(MIGRATOR, PW), text);

  // As phase_migrate runs it: from the repo, NODE_ENV=production, the DB_* variables and PGOPTIONS.
  const migEnv = (pgoptions) => ({
    PATH: process.env.PATH, HOME: os.tmpdir(), NODE_ENV: 'production', DB_SSL: 'false',
    DB_HOST: adminUrl.hostname, DB_PORT: adminUrl.port || '5432', DB_NAME: DB, DB_USER: MIGRATOR, DB_PASSWORD: PW,
    PGOPTIONS: pgoptions,
  });
  const trustCheck = (pgoptions) => spawnSync(process.execPath,
    [path.join(ROOT, 'scripts', 'deploy', 'migration-trust-check.js'), '--config', path.join(ROOT, 'src', 'config', 'sequelize.js')],
    { cwd: ROOT, env: migEnv(pgoptions), encoding: 'utf8' });
  const dbMigrate = (pgoptions) => spawnSync(path.join(ROOT, 'node_modules', '.bin', 'sequelize-cli'),
    ['db:migrate', '--config', path.join(ROOT, 'src', 'config', 'sequelize.js'), '--migrations-path', dir],
    { cwd: ROOT, env: migEnv(pgoptions), encoding: 'utf8' });
  const hits = async () => Number((await asAdmin('SELECT count(*)::int AS n FROM dh_attacker.hits')).rows[0].n);
  const probeRan = async () => (await asAdmin("SELECT to_regclass('public.probe_marker') IS NOT NULL AS ran")).rows[0].ran;

  beforeAll(async () => {
    admin = new Client({ connectionString: url });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
    for (const r of [APP, MIGRATOR]) {
      const { rows } = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [r]);
      if (rows.length) await admin.query(`DROP OWNED BY ${r}; DROP ROLE ${r}`);
    }
    await admin.query(`CREATE ROLE ${MIGRATOR} LOGIN CREATEROLE PASSWORD '${PW}'`);
    await admin.query(`CREATE ROLE ${APP} LOGIN PASSWORD '${PW}'`);
    await admin.query(`CREATE DATABASE ${DB} OWNER ${MIGRATOR}`);
    await asAdmin(`
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      ALTER SCHEMA public OWNER TO ${MIGRATOR};
      GRANT CONNECT, CREATE ON DATABASE ${DB} TO ${APP};
      GRANT USAGE, CREATE ON SCHEMA public TO ${APP};
      ALTER DEFAULT PRIVILEGES FOR ROLE ${MIGRATOR} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP};`);
    // The application role plants code: a schema of its own to count runs, and
    // an operator =(varchar, varchar) in public, the best match for any
    // varchar comparison, which would run as whoever compares.
    await asApp(`
      CREATE SCHEMA dh_attacker;
      GRANT USAGE ON SCHEMA dh_attacker TO PUBLIC;
      CREATE TABLE dh_attacker.hits (who text, at timestamptz DEFAULT now());
      GRANT INSERT ON dh_attacker.hits TO PUBLIC;
      CREATE FUNCTION dh_attacker.eq(varchar, varchar) RETURNS boolean LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO dh_attacker.hits (who) VALUES (current_user); RETURN $1::text = $2::text; END $$;
      CREATE FUNCTION public.eq(varchar, varchar) RETURNS boolean LANGUAGE sql AS 'SELECT dh_attacker.eq($1, $2)';
      CREATE OPERATOR public.= (LEFTARG = varchar, RIGHTARG = varchar, FUNCTION = public.eq);`);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-migrations-'));
    fs.writeFileSync(path.join(dir, '20990101000000-probe.js'), PROBE);
  }, 60000);

  afterAll(async () => {
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
      for (const r of [APP, MIGRATOR]) await admin.query(`DROP ROLE IF EXISTS ${r}`);
      await admin.end();
    }
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('the exploit is real: before this change, the migration session ran the planted operator as the migration role', async () => {
    // A copy of the probe under another name, so the guarded runs below still have it pending.
    const old = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-old-'));
    fs.writeFileSync(path.join(old, '20990101000001-old-probe.js'), PROBE.replace(/probe_marker/g, 'old_marker'));
    const res = spawnSync(path.join(ROOT, 'node_modules', '.bin', 'sequelize-cli'),
      ['db:migrate', '--config', path.join(ROOT, 'src', 'config', 'sequelize.js'), '--migrations-path', old],
      { cwd: ROOT, env: migEnv(UNPINNED), encoding: 'utf8' });
    fs.rmSync(old, { recursive: true, force: true });
    expect(res.status).toBe(0);
    const { rows } = await asAdmin('SELECT DISTINCT who FROM dh_attacker.hits');
    expect(rows.map((r) => r.who)).toEqual([MIGRATOR]);
    await asAdmin('DELETE FROM dh_attacker.hits');
  }, 60000);

  it('with production\'s grants the trust check refuses, so db:migrate never starts and the planted code never runs', async () => {
    const res = trustCheck(PINNED);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain(`UNTRUSTED: role ${APP} can CREATE in schema public, which is on the migration search path`);
    expect(res.stdout).toContain(`UNTRUSTED: operator public.= is owned by role ${APP}`);
    expect(res.stdout).toContain(`UNTRUSTED: function public.eq is owned by role ${APP}`);
    expect(res.stdout).toContain('FAIL:');
    // phase_migrate stops on a non-zero trust check (tests/unit/scripts/workflowDeployStagedMigrate.test.js).
    expect(await probeRan()).toBe(false);
    expect(await hits()).toBe(0);
  }, 60000);

  it('the trust check also refuses when the pin did not reach the connection', async () => {
    const res = trustCheck(UNPINNED);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('the session\'s search_path is ""$user", public", not "public"');
  }, 60000);

  it('once only trusted roles can create on the path, the migration runs pinned in every connection, and a look-alike schema is ignored', async () => {
    // The state the trust check requires: the planted objects in public gone and
    // the application role's CREATE on public revoked. It keeps CREATE on the database.
    await asAdmin(`DROP OPERATOR public.= (varchar, varchar); DROP FUNCTION public.eq(varchar, varchar);
      REVOKE CREATE ON SCHEMA public FROM ${APP};`);
    // It plants the same operator in a schema named after the migration role,
    // which comes first in that role's default search path ("$user", public).
    await asApp(`
      CREATE SCHEMA ${MIGRATOR};
      GRANT USAGE ON SCHEMA ${MIGRATOR} TO PUBLIC;
      CREATE FUNCTION ${MIGRATOR}.eq(varchar, varchar) RETURNS boolean LANGUAGE sql AS 'SELECT dh_attacker.eq($1, $2)';
      CREATE OPERATOR ${MIGRATOR}.= (LEFTARG = varchar, RIGHTARG = varchar, FUNCTION = ${MIGRATOR}.eq);`);

    // Without the pin, an ordinary comparison by the migration role runs it.
    await asMigrator("SELECT 1 WHERE 'x'::varchar = 'x'::varchar");
    expect(await hits()).toBe(1);
    await asAdmin('DELETE FROM dh_attacker.hits');

    const trust = trustCheck(PINNED);
    expect(trust.stdout).toContain('OK: search_path is "public"');
    expect(trust.status).toBe(0);

    const res = dbMigrate(PINNED);
    expect(res.status).toBe(0);
    expect(await probeRan()).toBe(true);
    const { rows: [marker] } = await asAdmin('SELECT own, second, child FROM public.probe_marker');
    // The migration's own connection, a second connection it opened, and a child process it started.
    expect(marker).toEqual({ own: 'public', second: 'public', child: 'public' });
    // The planted operator never ran, and the table went into public, not the look-alike schema.
    expect(await hits()).toBe(0);
    const { rows: [{ n }] } = await asAdmin(`SELECT count(*)::int AS n FROM pg_class WHERE relnamespace = '${MIGRATOR}'::regnamespace`);
    expect(n).toBe(0);
  }, 90000);
});
