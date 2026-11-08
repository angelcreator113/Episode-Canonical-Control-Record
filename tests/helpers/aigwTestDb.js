'use strict';

/**
 * AI gateway G2 integration tests: a throwaway database per test file.
 *
 * The ledger's control row is a singleton and its history tables are
 * append-only (they refuse DELETE and TRUNCATE), so tests cannot share one
 * database or clean up after themselves. Each file gets its own database,
 * created from the admin URL of the local or CI test server, with only the
 * G2 migration applied, and its own tagged roles built from
 * src/aiGateway/aigwDbGrants.js. Teardown removes the database and the
 * roles. Never runs against anything but a test server (the same guard as
 * workerRestrictedRole.integration.test.js).
 *
 * As in production (Option A, Evoni 2026-11-08): a separate, non-superuser
 * migration login runs the migration and so owns every aigw object; nothing
 * moves ownership. Runtime roles get their grants from the owning migration
 * login, as the hand-run role script (scripts/aigw/sql/aigw-roles.sql) does.
 */

const crypto = require('crypto');
const { Client, Pool } = require('pg');
const { Sequelize } = require('sequelize');
const migration = require('../../src/migrations/20261108120000-create-aigw-ledger');
const grants = require('../../src/aiGateway/aigwDbGrants');

const ADMIN_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const shouldSkip = !ADMIN_URL || ADMIN_URL.includes('amazonaws.com') || !ADMIN_URL.includes('episode_metadata_test');
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;
const KINDS = ['caller', 'gateway', 'admin', 'inspector'];

function urlFor(dbName, role, password) {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${dbName}`;
  if (role) {
    u.username = role;
    u.password = password;
  }
  return u.toString();
}

/**
 * The ownership move of the REJECTED first role-script design (a NOLOGIN
 * owner role). Option A keeps ownership with the migration login; this
 * exists only so a test can show the deploy's migration trust check refuses
 * the old design. Kept out of src/ so the application source holds no DDL
 * text (tests/unit/guards/noRuntimeDdl.test.js).
 */
function rejectedOwnershipStatements(owner, functions = migration.FUNCTIONS) {
  return [
    ...grants.TABLES.map((t) => `ALTER TABLE public.${t} OWNER TO ${ident(owner)}`),
    ...functions.map((f) => `ALTER FUNCTION public.${f} OWNER TO ${ident(owner)}`),
  ];
}

const portOf = (pool) => (sql, params) => pool.query(sql, params).then((r) => r.rows);

/**
 * Create the database and a migration login (`migrator`: LOGIN, not a
 * superuser, CREATEROLE, owner of the database) that runs the migration. Then one
 * login per runtime role kind, plus `app`: a login with no aigw grant,
 * standing in for the existing application role.
 */
async function createAigwTestDb({ poolMax = 10 } = {}) {
  const tag = crypto.randomBytes(4).toString('hex');
  const dbName = `aigw_t_${tag}`;
  const password = `pw-${crypto.randomBytes(12).toString('hex')}`;
  const roles = {
    migrator: `aigw_migrator_${tag}`,
    caller: `aigw_caller_${tag}`,
    gateway: `aigw_gateway_${tag}`,
    admin: `aigw_admin_${tag}`,
    inspector: `aigw_inspector_${tag}`,
    app: `aigw_app_${tag}`,
  };
  const server = new Client({ connectionString: ADMIN_URL });
  await server.connect();
  await server.query(`CREATE DATABASE ${ident(dbName)}`);

  const su = new Client({ connectionString: urlFor(dbName) });
  await su.connect();
  // Like production's migration login (`postgres` on RDS): not a superuser,
  // CREATEROLE, and the owner of the database (so pg_database_owner, which
  // owns schema public).
  await su.query(`CREATE ROLE ${ident(roles.migrator)} LOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOINHERIT PASSWORD '${password}'`);
  await su.query(`ALTER DATABASE ${ident(dbName)} OWNER TO ${ident(roles.migrator)}`);

  const sequelize = new Sequelize(urlFor(dbName, roles.migrator, password), { logging: false, pool: { max: 2 } });
  await migration.up(sequelize.getQueryInterface(), Sequelize);

  const migrator = new Client({ connectionString: urlFor(dbName, roles.migrator, password) });
  await migrator.connect();
  for (const kind of [...KINDS, 'app']) {
    await su.query(`CREATE ROLE ${ident(roles[kind])} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${password}'`);
    if (kind === 'app') {
      await migrator.query(`GRANT CONNECT ON DATABASE ${ident(dbName)} TO ${ident(roles.app)}`);
      await migrator.query(`GRANT USAGE ON SCHEMA public TO ${ident(roles.app)}`);
    } else {
      // granted by the owning migration login, as the role script is run
      for (const sql of grants.grantStatements(kind, roles[kind], dbName)) await migrator.query(sql);
    }
  }

  const pools = {};
  for (const kind of [...KINDS, 'app']) {
    pools[kind] = new Pool({ connectionString: urlFor(dbName, roles[kind], password), max: poolMax });
    pools[kind].on('error', (err) => console.error(`[aigw test] pool ${kind}: ${err.message}`));
  }

  async function close() {
    await Promise.all(Object.values(pools).map((p) => p.end().catch((err) => console.error(`[aigw test] pool end: ${err.message}`))));
    await migrator.end().catch((err) => console.error(`[aigw test] migrator end: ${err.message}`));
    await su.end().catch((err) => console.error(`[aigw test] su end: ${err.message}`));
    await sequelize.close().catch((err) => console.error(`[aigw test] sequelize close: ${err.message}`));
    await server.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [dbName]);
    await server.query(`DROP DATABASE IF EXISTS ${ident(dbName)}`);
    for (const r of Object.values(roles)) {
      await server.query(`DROP ROLE IF EXISTS ${ident(r)}`).catch((err) => console.error(`[aigw test] could not drop ${r}: ${err.message}`));
    }
    await server.end();
  }

  return {
    tag, dbName, roles, password, sequelize, su, migrator, pools,
    port: (kind) => portOf(pools[kind]),
    url: (kind) => (kind === 'su' ? urlFor(dbName) : urlFor(dbName, roles[kind], password)),
    close,
  };
}

module.exports = { ADMIN_URL, shouldSkip, createAigwTestDb, rejectedOwnershipStatements, urlFor, ident, KINDS };
