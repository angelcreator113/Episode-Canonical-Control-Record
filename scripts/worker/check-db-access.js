#!/usr/bin/env node
/**
 * scripts/worker/check-db-access.js: the episode worker's database preflight
 * (issue #3714). It checks the worker's own login without starting the
 * worker: it connects once, as WORKER_DB_USER, in a read-only session, reads
 * the role's attributes and privileges from the catalog, and exits.
 *
 *   node scripts/worker/check-db-access.js
 *
 * It never writes: the session is read-only (default_transaction_read_only,
 * inside a READ ONLY transaction that is rolled back), and every query is a
 * catalog read or a SELECT ... LIMIT 0 that returns no rows. It never runs
 * the worker's boot recovery, polls nothing and calls no AI provider.
 *
 * Settings (issue #3714, Option B):
 *   - the login (WORKER_DB_USER, WORKER_DB_PASSWORD) only from the worker's
 *     credential file, WORKER_DB_CREDENTIALS_FILE (default
 *     /home/ubuntu/.episode-worker-db.env), checked by the same loader the
 *     worker uses (src/workers/workerCredentials.js: regular file, no
 *     symlink, owned by the user running this, mode 600, no postgres);
 *   - DB_HOST, DB_PORT (5432), DB_NAME, DB_SSL ("false" turns TLS off),
 *     DB_SSL_REJECT_UNAUTHORIZED from the environment, else from the repo's
 *     .env, which is parsed, not loaded into the environment.
 * It never uses DB_USER / DB_PASSWORD (the API's login). A WORKER_DB_PASSWORD
 * in the environment or in .env is a stale copy and fails the settings.
 *
 * Prints PASS / FAIL / WARN lines and never the password or the host.
 * Exit codes: 0 every check passed; 1 a check failed; 2 the settings are
 * missing or the connection failed.
 */
'use strict';

const path = require('path');
const { TABLE_GRANTS, SEQUENCE_GRANTS, TABLE_PRIVILEGES, CONNECTION_LIMIT } = require('../../src/workers/workerDbGrants');

const MASTER_LOGINS = new Set(['postgres', 'rdsadmin']);

/**
 * The connection settings, or { error } naming what is wrong (never a value).
 * @param {object} env          DB_HOST / DB_NAME / DB_PORT / DB_SSL* (environment, then .env)
 * @param {object} credentials  { user, password } from the credential file, or { error }
 */
function loadSettings(env = process.env, credentials) {
  if (String(env.WORKER_DB_PASSWORD || '') !== '') {
    return { error: 'WORKER_DB_PASSWORD is set in the environment or .env; the worker\'s password lives only in its credential file, so remove that copy' };
  }
  if (!credentials || credentials.error) {
    return { error: `credential file: ${credentials ? credentials.error : 'not read'}` };
  }
  const missing = ['DB_HOST', 'DB_NAME'].filter((k) => !String(env[k] || '').trim());
  if (missing.length) return { error: `missing: ${missing.join(', ')}` };
  const user = String(credentials.user || '').trim();
  if (!user || !credentials.password) return { error: 'credential file: missing WORKER_DB_USER or WORKER_DB_PASSWORD' };
  if (MASTER_LOGINS.has(user.toLowerCase())) return { error: `the credential file names the master login (${user}); the worker runs as its own role` };
  const ssl = String(env.DB_SSL || 'true').toLowerCase() === 'false'
    ? false
    : { rejectUnauthorized: String(env.DB_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() === 'true' };
  return {
    user,
    database: String(env.DB_NAME).trim(),
    config: {
      host: String(env.DB_HOST).trim(),
      port: Number(env.DB_PORT) || 5432,
      database: String(env.DB_NAME).trim(),
      user,
      password: credentials.password,
      ssl,
      connectionTimeoutMillis: 10000,
      query_timeout: 15000,
      application_name: 'episode-worker-preflight',
    },
  };
}

/** The repo's .env parsed (not loaded), overlaid by the environment. */
function readSettingsEnv(env = process.env, envFile = path.join(__dirname, '..', '..', '.env')) {
  let fromFile = {};
  try {
    fromFile = require('dotenv').parse(require('fs').readFileSync(envFile));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`WARN settings: .env could not be read (${err.code || 'error'})`);
  }
  return { ...fromFile, ...env };
}

/** The worker's credentials from its file, or { error } (never the contents). */
function readCredentials(env, opts = {}) {
  const { readCredentialFile, DEFAULT_CREDENTIALS_FILE } = require('../../src/workers/workerCredentials');
  const file = String(env.WORKER_DB_CREDENTIALS_FILE || '').trim() || DEFAULT_CREDENTIALS_FILE;
  try {
    return readCredentialFile(file, opts);
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * The checks, on a connected client whose session is already read-only.
 * Returns { ok, results: [{ status: 'PASS'|'FAIL'|'WARN', check, detail }] }.
 */
async function checkWorkerDbAccess(client, { expectedUser, tableGrants = TABLE_GRANTS, sequenceGrants = SEQUENCE_GRANTS, connectionLimit = CONNECTION_LIMIT } = {}) {
  const results = [];
  const add = (status, check, detail = '') => results.push({ status, check, detail });
  const one = async (sql, params = []) => (await client.query(sql, params)).rows[0];
  const all = async (sql, params = []) => (await client.query(sql, params)).rows;

  // 1. Who this session is.
  const me = await one(`SELECT current_user AS u, current_database() AS db,
      r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolreplication, r.rolbypassrls, r.rolinherit, r.rolconnlimit
    FROM pg_roles r WHERE r.rolname = current_user`);
  if (expectedUser && me.u !== expectedUser) add('FAIL', 'login', `connected as ${me.u}, expected ${expectedUser}`);
  else add('PASS', 'login', `connected as ${me.u} to ${me.db}`);
  for (const [attr, label] of [['rolsuper', 'superuser'], ['rolcreaterole', 'CREATEROLE'], ['rolcreatedb', 'CREATEDB'], ['rolreplication', 'REPLICATION'], ['rolbypassrls', 'BYPASSRLS']]) {
    add(me[attr] ? 'FAIL' : 'PASS', `not ${label}`, me[attr] ? `the role has ${label}` : '');
  }
  const limit = Number(me.rolconnlimit);
  add(limit >= 1 && limit <= connectionLimit ? 'PASS' : 'FAIL', `connection limit ≤ ${connectionLimit}`, `rolconnlimit = ${limit}`);

  // 2. No inherited privileges from other roles.
  const memberOf = await all(`SELECT g.rolname FROM pg_auth_members m
      JOIN pg_roles g ON g.oid = m.roleid JOIN pg_roles r ON r.oid = m.member
     WHERE r.rolname = current_user ORDER BY 1`);
  add(memberOf.length ? 'FAIL' : 'PASS', 'member of no other role', memberOf.map((r) => r.rolname).join(', '));

  // 3. Schema and database.
  const sch = await one(`SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS usage,
      has_schema_privilege(current_user, 'public', 'CREATE') AS create,
      has_database_privilege(current_user, current_database(), 'CREATE') AS dbcreate,
      has_database_privilege(current_user, current_database(), 'TEMP') AS temp`);
  add(sch.usage ? 'PASS' : 'FAIL', 'USAGE on schema public');
  add(sch.create ? 'FAIL' : 'PASS', 'no CREATE on schema public');
  add(sch.dbcreate ? 'FAIL' : 'PASS', 'no CREATE on the database');
  // TEMP is usually granted to PUBLIC, not to the role; the worker never uses it.
  if (sch.temp) add('WARN', 'TEMP on the database', 'granted (normally through PUBLIC); the worker never creates temp tables');

  // 4. The tables it needs: present, exactly the granted privileges.
  for (const [table, granted] of Object.entries(tableGrants)) {
    const exists = await one('SELECT to_regclass($1) IS NOT NULL AS ok', [`public.${table}`]);
    if (!exists.ok) { add('FAIL', `table ${table}`, 'does not exist'); continue; }
    let tableOk = true;
    for (const priv of TABLE_PRIVILEGES) {
      const has = (await one('SELECT has_table_privilege(current_user, $1, $2) AS ok', [`public.${table}`, priv])).ok;
      const want = granted.includes(priv);
      if (want && !has) { add('FAIL', `${priv} on ${table}`, 'missing'); tableOk = false; }
      else if (!want && has) { add('FAIL', `no ${priv} on ${table}`, 'granted but not needed'); tableOk = false; }
    }
    if (tableOk) add('PASS', `${table}`, `${granted.join(', ')} only`);
    if (granted.includes('SELECT')) {
      // A read that returns no rows: proves the grant works end to end.
      await client.query(`SELECT 1 FROM public."${table.replace(/"/g, '""')}" LIMIT 0`);
    }
  }

  // 5. No other table, view or materialized view.
  const extraTables = await all(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r','p','v','m','f')
       AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
       AND NOT (n.nspname = 'public' AND c.relname = ANY($1::text[]))
       AND has_table_privilege(current_user, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     ORDER BY 1`, [Object.keys(tableGrants)]);
  add(extraTables.length ? 'FAIL' : 'PASS', 'no other table', extraTables.map((r) => r.relname).join(', '));

  // 6. Sequences: exactly the granted ones.
  for (const [seq, granted] of Object.entries(sequenceGrants)) {
    const exists = await one('SELECT to_regclass($1) IS NOT NULL AS ok', [`public.${seq}`]);
    if (!exists.ok) { add('FAIL', `sequence ${seq}`, 'does not exist'); continue; }
    for (const priv of ['USAGE', 'SELECT', 'UPDATE']) {
      const has = (await one('SELECT has_sequence_privilege(current_user, $1, $2) AS ok', [`public.${seq}`, priv])).ok;
      const want = granted.includes(priv);
      if (want && !has) add('FAIL', `${priv} on ${seq}`, 'missing');
      else if (!want && has) add('FAIL', `no ${priv} on ${seq}`, 'granted but not needed');
    }
  }
  const extraSeqs = await all(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'S' AND n.nspname = 'public' AND NOT (c.relname = ANY($1::text[]))
       AND has_sequence_privilege(current_user, c.oid, 'USAGE, SELECT, UPDATE')
     ORDER BY 1`, [Object.keys(sequenceGrants)]);
  add(extraSeqs.length ? 'FAIL' : 'PASS', 'no other sequence', extraSeqs.map((r) => r.relname).join(', '));

  return { ok: !results.some((r) => r.status === 'FAIL'), results };
}

async function main() {
  const env = readSettingsEnv(process.env);
  const settings = loadSettings(env, readCredentials(env));
  if (settings.error) {
    console.error(`FAIL settings: ${settings.error}`);
    return 2;
  }
  const { Client } = require('pg');
  const client = new Client(settings.config);
  try {
    await client.connect();
  } catch (err) {
    // pg's message names the user, never the password; the host is left out.
    console.error(`FAIL connect: as ${settings.user} to ${settings.database}: ${err.message}`);
    return 2;
  }
  try {
    await client.query('SET default_transaction_read_only = on');
    await client.query("SET statement_timeout = '10s'");
    await client.query('BEGIN READ ONLY');
    const { ok, results } = await checkWorkerDbAccess(client, { expectedUser: settings.user });
    await client.query('ROLLBACK');
    for (const r of results) console.log(`${r.status} ${r.check}${r.detail ? `: ${r.detail}` : ''}`);
    console.log(ok ? 'RESULT: PASS (nothing was written)' : 'RESULT: FAIL (nothing was written)');
    return ok ? 0 : 1;
  } catch (err) {
    console.error(`FAIL check: ${err.message}`);
    return 2;
  } finally {
    await client.end().catch((e) => console.error(`[check-db-access] close failed: ${e.message}`));
  }
}

if (require.main === module) {
  main().then((code) => process.exit(code), (err) => {
    console.error(`FAIL: ${err.message}`);
    process.exit(2);
  });
}

module.exports = { loadSettings, readSettingsEnv, readCredentials, checkWorkerDbAccess };
