'use strict';

// scripts/dev-db/sql/dev-refresh-ro-role.sql (Task #3716): the read-only role
// the dev-box refresh dumps production with. Against a scratch database, it
// must:
//   1. read every table and every sequence, including ones created after the
//      grants (pg_dump reads each sequence's last_value);
//   2. refuse data_correction_log, every write, nextval and DDL;
//   3. let pg_dump, run as the role and excluding data_correction_log, finish.
// Runs where TEST_DATABASE_URL is set (CI's Tests job, and a local docker
// compose postgres); skipped elsewhere.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const SQL_FILE = path.join(ROOT, 'scripts', 'dev-db', 'sql', 'dev-refresh-ro-role.sql');
const PG_URL = process.env.TEST_DATABASE_URL;
const ROLE = 'dev_refresh_ro';

test('the role file names the grants it needs and keeps data_correction_log out', () => {
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  expect(sql).toMatch(/CREATE ROLE dev_refresh_ro LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION CONNECTION LIMIT 2;/);
  expect(sql).toContain('GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO dev_refresh_ro;');
  expect(sql).toContain('ALTER DEFAULT PRIVILEGES FOR ROLE :"migrate_user" IN SCHEMA public GRANT SELECT ON SEQUENCES TO dev_refresh_ro;');
  expect(sql).toContain('REVOKE ALL ON public.data_correction_log FROM dev_refresh_ro;');
  expect(sql).toContain("ALTER ROLE dev_refresh_ro SET default_transaction_read_only = on;");
  expect(sql).not.toMatch(/\bPASSWORD\s+'/i);
  // Only SELECT/USAGE/CONNECT are ever granted.
  for (const m of sql.matchAll(/^\s*(?:ALTER DEFAULT PRIVILEGES[^;]*?)?GRANT ([A-Z, ]+?) ON /gm)) {
    expect(['SELECT', 'USAGE', 'CONNECT']).toContain(m[1].trim());
  }
});

(PG_URL ? describe : describe.skip)('sql/dev-refresh-ro-role.sql against a scratch database', () => {
  const { Client } = require('pg');
  const DB = `devrefresh_selftest_${process.pid}`;
  const PASSWORD = `rr-${process.pid}-${Date.now()}`;
  const urlFor = (db, user, password) => {
    const u = new URL(PG_URL);
    u.pathname = `/${db}`;
    if (user) { u.username = user; u.password = password; }
    return u.toString();
  };
  let ro;
  let tmp;

  beforeAll(async () => {
    const c = new Client({ connectionString: PG_URL });
    await c.connect();
    const left = await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [ROLE]);
    if (left.rows.length) { await c.end(); throw new Error(`a ${ROLE} role already exists on this server; drop it before running this test`); }
    await c.query(`CREATE DATABASE ${DB}`);
    await c.end();

    const d = new Client({ connectionString: urlFor(DB) });
    await d.connect();
    await d.query('CREATE TABLE shows (id serial PRIMARY KEY, name text)');
    await d.query("INSERT INTO shows (name) VALUES ('Styling Adventures'), ('Before Lala')");
    await d.query('CREATE TABLE data_correction_log (id serial PRIMARY KEY, note text)');
    await d.query("INSERT INTO data_correction_log (note) VALUES ('undo record')");
    // psql meta-commands (\set) are for the operator's psql run, not for pg.
    const sql = fs.readFileSync(SQL_FILE, 'utf8')
      .split('\n').filter((l) => !l.startsWith('\\')).join('\n')
      .replace(/:"dbname"/g, `"${DB}"`)
      .replace(/:"migrate_user"/g, `"${new URL(PG_URL).username}"`);
    await d.query(sql);
    await d.query(`ALTER ROLE ${ROLE} PASSWORD '${PASSWORD}'`);
    // Created after the grants, as the migration user would: still readable.
    await d.query('CREATE TABLE episodes (id serial PRIMARY KEY)');
    await d.query('INSERT INTO episodes DEFAULT VALUES');
    await d.end();

    ro = new Client({ connectionString: urlFor(DB, ROLE, PASSWORD) });
    await ro.connect();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devrefresh-'));
  });

  afterAll(async () => {
    if (ro) await ro.end().catch((e) => console.error('closing the role connection:', e.message));
    const c = new Client({ connectionString: PG_URL });
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
    await c.query(`DROP ROLE IF EXISTS ${ROLE}`);
    await c.end();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  const refused = async (q) => {
    try { await ro.query(q); return 'allowed'; } catch (e) { return e.code; }
  };

  test('reads tables and sequences, including ones created after the grants', async () => {
    expect((await ro.query('SELECT count(*)::int AS n FROM shows')).rows[0].n).toBe(2);
    expect((await ro.query('SELECT count(*)::int AS n FROM episodes')).rows[0].n).toBe(1);
    expect((await ro.query('SELECT last_value::int AS v FROM shows_id_seq')).rows[0].v).toBe(2);
    expect((await ro.query('SELECT last_value::int AS v FROM episodes_id_seq')).rows[0].v).toBe(1);
    const s = (await ro.query("SELECT current_user AS u, current_setting('default_transaction_read_only') AS ro, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS su")).rows[0];
    expect(s).toEqual({ u: ROLE, ro: 'on', su: false });
  });

  test('refuses data_correction_log, writes, nextval and DDL', async () => {
    expect(await refused('SELECT count(*) FROM data_correction_log')).toBe('42501');
    expect(await refused('SELECT last_value FROM data_correction_log_id_seq')).toBe('allowed'); // a counter, no row data
    expect(await refused("INSERT INTO shows (name) VALUES ('x')")).toBe('25006');
    expect(await refused("SELECT nextval('shows_id_seq')")).toMatch(/^(25006|42501)$/);
    expect(await refused('CREATE TABLE t (x int)')).toMatch(/^(25006|42501)$/);
    // With the session default switched off, privileges alone still refuse.
    await ro.query('SET default_transaction_read_only = off');
    expect(await refused("INSERT INTO shows (name) VALUES ('x')")).toBe('42501');
    expect(await refused("SELECT nextval('shows_id_seq')")).toBe('42501');
    expect(await refused('CREATE TABLE t (x int)')).toBe('42501');
    await ro.query('SET default_transaction_read_only = on');
  });

  test('pg_dump as the role, excluding data_correction_log, finishes; including it is refused', () => {
    const which = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
    if (which.status !== 0) { console.warn('pg_dump not installed here; skipping the dump check'); return; }
    const env = { PATH: process.env.PATH };
    const out = path.join(tmp, 'd.dump');
    const ok = spawnSync('pg_dump', ['-Fc', '--no-owner', '--no-acl', '--exclude-table=public.data_correction_log', '-f', out, urlFor(DB, ROLE, PASSWORD)], { env, encoding: 'utf8' });
    if (/server version mismatch|aborting because of server version/.test(ok.stderr)) { console.warn('pg_dump older than the server; skipping the dump check'); return; }
    expect(ok.stderr).toBe('');
    expect(ok.status).toBe(0);
    expect(fs.statSync(out).size).toBeGreaterThan(0);
    const bad = spawnSync('pg_dump', ['-Fc', '-f', path.join(tmp, 'all.dump'), urlFor(DB, ROLE, PASSWORD)], { env, encoding: 'utf8' });
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toMatch(/permission denied for table data_correction_log/);
    expect(bad.stderr).not.toContain(PASSWORD);
  });
});
