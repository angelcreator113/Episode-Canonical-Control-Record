#!/usr/bin/env node
// scripts/diagnostics/db-check.js — the database half of the Diagnostics
// workflow (F-Tools-2, 2026-10-29). Runs on the production box only, called by
// on-box.sh, as the read-only database role prime_readonly.
//
// Every statement is fixed in this file: there is no way to pass SQL in. The
// connection host, port, database and SSL setting come from the app's .env
// (the same DB_* names src/config/sequelize.js reads in production); the user
// and password come from ~/.episode-readonly.env, a mode-600 file Evoni
// creates. Neither the password nor any row of personal data is printed: the
// checks report counts, names of tables and migrations, and PASS/FAIL lines.
//
// Usage: node db-check.js <db|db-schema|db-counts|self-test>
// Needs: APP_DIR (default /home/ubuntu/episode-metadata), HOME.
// Exit: 0 ok; 1 a check failed; 2 bad usage or missing configuration.

'use strict';

const fs = require('fs');
const path = require('path');

const APP_DIR = process.env.APP_DIR || '/home/ubuntu/episode-metadata';
const RO_ENV = process.env.RO_ENV || path.join(process.env.HOME || '/home/ubuntu', '.episode-readonly.env');
const MODES = ['db', 'db-schema', 'db-counts', 'self-test'];

// Exact counts for the tables a production question usually turns on. Missing
// tables are reported as missing, not as errors.
const COUNT_TABLES = [
  'shows', 'episodes', 'episode_briefs', 'episode_scripts', 'raw_footage',
  'assets', 'wardrobe', 'episode_wardrobe', 'scene_sets', 'scene_angles',
  'registry_characters', 'world_events', 'career_goals', 'season_slots',
  'ai_usage_logs', 'feed_posts', 'users',
];

/** Parses KEY=value lines; ignores comments and blank lines; strips matching quotes. */
function parseEnvFile(text) {
  const out = {};
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/** The connection settings: host and database from the app's .env, user and password from the read-only file. */
function connectionConfig({ appEnv, roEnv }) {
  const host = appEnv.DB_HOST;
  const database = appEnv.DB_NAME || appEnv.DB_DATABASE;
  if (!host || !database) throw new Error('DB_HOST or DB_NAME is not set in the app .env');
  if (!roEnv.DB_USER || !roEnv.DB_PASSWORD) throw new Error(`DB_USER or DB_PASSWORD is missing from ${RO_ENV}`);
  return {
    host,
    port: parseInt(appEnv.DB_PORT || '5432', 10),
    database,
    user: roEnv.DB_USER,
    password: roEnv.DB_PASSWORD,
    ssl: appEnv.DB_SSL === 'false' ? false : { rejectUnauthorized: appEnv.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
    application_name: 'prime-diagnostics',
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    query_timeout: 35000,
  };
}

function loadPg() {
  // The script runs from a temporary copy, so resolve pg from the app's install.
  return require(require.resolve('pg', { paths: [APP_DIR] }));
}

async function checkDb(client, say) {
  const t0 = Date.now();
  const r = await client.query(
    "SELECT current_user AS who, current_setting('transaction_read_only') AS ro, "
    + "current_setting('server_version') AS version, pg_size_pretty(pg_database_size(current_database())) AS size, "
    + '(SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS connections',
  );
  const row = r.rows[0];
  say(`connected: yes (${Date.now() - t0} ms round trip)`);
  say(`user: ${row.who}; read-only session: ${row.ro}`);
  say(`server: PostgreSQL ${row.version}; database size: ${row.size}; open connections: ${row.connections}`);
  const applied = await client.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
  const appliedSet = new Set(applied.rows.map((x) => x.name));
  const dir = path.join(APP_DIR, 'src', 'migrations');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort() : [];
  const pending = files.filter((f) => !appliedSet.has(f));
  say(`migrations: ${appliedSet.size} applied; ${files.length} files in the deployed tree; ${pending.length} pending`);
  for (const f of pending.slice(0, 20)) say(`  pending: ${f}`);
  for (const f of applied.rows.slice(-3)) say(`  latest applied: ${f.name}`);
  return true;
}

async function checkSchema(client, say) {
  const r = await client.query(
    'SELECT c.table_name, count(*)::int AS columns, '
    + "bool_or(c.column_name = 'deleted_at') AS paranoid "
    + 'FROM information_schema.columns c '
    + "WHERE c.table_schema = 'public' GROUP BY c.table_name ORDER BY c.table_name",
  );
  say(`tables in public: ${r.rows.length}`);
  for (const t of r.rows) say(`  ${t.table_name}: ${t.columns} columns${t.paranoid ? '' : ' (no deleted_at)'}`);
  return true;
}

async function checkCounts(client, say) {
  say('exact counts:');
  for (const t of COUNT_TABLES) {
    const exists = await client.query('SELECT to_regclass($1) IS NOT NULL AS ok', [`public.${t}`]);
    if (!exists.rows[0].ok) { say(`  ${t}: (no such table)`); continue; }
    // The name is from the fixed list above, never from input.
    const c = await client.query(`SELECT count(*)::bigint AS n FROM public."${t}"`);
    say(`  ${t}: ${c.rows[0].n}`);
  }
  const est = await client.query(
    'SELECT relname, n_live_tup::bigint AS n FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 25',
  );
  say('largest tables (estimated rows):');
  for (const t of est.rows) say(`  ${t.relname}: ~${t.n}`);
  return true;
}

/** Expects the statement to fail with one of the given SQLSTATE codes. */
async function expectRefused(client, say, label, sql, codes) {
  try {
    await client.query(sql);
    say(`FAIL ${label}: the statement succeeded`);
    return false;
  } catch (err) {
    if (codes.includes(err.code)) { say(`PASS ${label}: refused (${err.code})`); return true; }
    say(`FAIL ${label}: unexpected error ${err.code || 'unknown'}`);
    return false;
  } finally {
    // A failed statement inside a transaction would poison the next one.
    await client.query('ROLLBACK').catch((e) => say(`note: rollback after ${label}: ${e.code || 'error'}`));
  }
}

async function selfTest(client, say) {
  let ok = true;
  const who = await client.query("SELECT current_user AS who, current_setting('transaction_read_only') AS ro, "
    + '(SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super');
  const { who: user, ro, super: isSuper } = who.rows[0];
  if (user === 'prime_readonly') say('PASS connected as prime_readonly'); else { say(`FAIL connected as ${user}, not prime_readonly`); ok = false; }
  if (ro === 'on') say('PASS the session defaults to read-only'); else { say('FAIL the session is not read-only by default'); ok = false; }
  if (isSuper === false) say('PASS not a superuser'); else { say('FAIL the role is a superuser'); ok = false; }
  const sel = await client.query('SELECT count(*)::int AS n FROM "SequelizeMeta"');
  say(`PASS a read works (${sel.rows[0].n} migration rows)`);
  // 25006 = read_only_sql_transaction; 42501 = insufficient_privilege.
  ok = await expectRefused(client, say, 'create a table in the default session', 'CREATE TEMP TABLE diag_selftest(i int)', ['25006', '42501']) && ok;
  // With the read-only default switched off, the grants alone must still refuse writes.
  ok = await expectRefused(client, say, 'update with read-only switched off',
    'BEGIN READ WRITE; UPDATE "SequelizeMeta" SET name = name WHERE false', ['42501']) && ok;
  ok = await expectRefused(client, say, 'insert with read-only switched off',
    'BEGIN READ WRITE; INSERT INTO "SequelizeMeta"(name) SELECT \'diag-selftest\' WHERE false', ['42501']) && ok;
  ok = await expectRefused(client, say, 'delete with read-only switched off',
    'BEGIN READ WRITE; DELETE FROM "SequelizeMeta" WHERE false', ['42501']) && ok;
  ok = await expectRefused(client, say, 'read a server file', "SELECT pg_read_file('/etc/hostname')", ['42501']) && ok;
  return ok;
}

async function main(mode, say = (l) => process.stdout.write(`${l}\n`)) {
  if (!MODES.includes(mode)) { say(`unknown database check '${mode}'`); return 2; }
  let cfg;
  try {
    const appEnvPath = path.join(APP_DIR, '.env');
    const appEnv = fs.existsSync(appEnvPath) ? parseEnvFile(fs.readFileSync(appEnvPath, 'utf8')) : {};
    if (!fs.existsSync(RO_ENV)) { say(`not configured: ${RO_ENV} does not exist (setup step 3)`); return 2; }
    const mode600 = (fs.statSync(RO_ENV).mode & 0o077) === 0;
    if (!mode600) { say(`not configured: ${RO_ENV} is readable by others; chmod 600 it`); return 2; }
    cfg = connectionConfig({ appEnv, roEnv: parseEnvFile(fs.readFileSync(RO_ENV, 'utf8')) });
  } catch (err) {
    say(`not configured: ${err.message}`);
    return 2;
  }
  const { Client } = loadPg();
  const client = new Client(cfg);
  try {
    await client.connect();
  } catch (err) {
    say(`connected: NO (${err.code || 'error'}: ${String(err.message).slice(0, 200)})`);
    return 1;
  }
  try {
    const run = { db: checkDb, 'db-schema': checkSchema, 'db-counts': checkCounts, 'self-test': selfTest }[mode];
    return (await run(client, say)) ? 0 : 1;
  } catch (err) {
    say(`error: ${err.code || 'unknown'}: ${String(err.message).slice(0, 200)}`);
    return 1;
  } finally {
    await client.end().catch((e) => say(`note: closing the connection: ${e.code || 'error'}`));
  }
}

module.exports = { parseEnvFile, connectionConfig, main, COUNT_TABLES, MODES };

if (require.main === module) {
  main(process.argv[2]).then((code) => { process.exitCode = code; });
}
