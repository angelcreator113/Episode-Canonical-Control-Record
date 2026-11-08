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
 */

const crypto = require('crypto');
const { Client, Pool } = require('pg');
const { Sequelize } = require('sequelize');
const migration = require('../../src/migrations/20261108120000-create-aigw-ledger');
const grants = require('../../src/aiGateway/aigwDbGrants');

const ADMIN_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const shouldSkip = !ADMIN_URL || ADMIN_URL.includes('amazonaws.com') || !ADMIN_URL.includes('episode_metadata_test');
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

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
 * The ownership move the role script makes: every aigw table and function to
 * the owner role. Kept here, not in src/, so the application source holds no
 * DDL text (tests/unit/guards/noRuntimeDdl.test.js).
 */
function ownershipStatements(owner, functions = migration.FUNCTIONS) {
  return [
    ...grants.TABLES.map((t) => `ALTER TABLE public.${t} OWNER TO ${ident(owner)}`),
    ...functions.map((f) => `ALTER FUNCTION public.${f} OWNER TO ${ident(owner)}`),
  ];
}

const portOf = (pool) => (sql, params) => pool.query(sql, params).then((r) => r.rows);

/**
 * Create the database, apply the migration, move ownership to a NOLOGIN
 * owner role, and create one login per role kind plus `app` (a login with no
 * aigw grant, standing in for the existing application role).
 */
async function createAigwTestDb({ poolMax = 10, ownership = true } = {}) {
  const tag = crypto.randomBytes(4).toString('hex');
  const dbName = `aigw_t_${tag}`;
  const password = `pw-${crypto.randomBytes(12).toString('hex')}`;
  const roles = {
    owner: `aigw_owner_${tag}`,
    caller: `aigw_caller_${tag}`,
    gateway: `aigw_gateway_${tag}`,
    admin: `aigw_admin_${tag}`,
    inspector: `aigw_inspector_${tag}`,
    app: `aigw_app_${tag}`,
  };
  const server = new Client({ connectionString: ADMIN_URL });
  await server.connect();
  await server.query(`CREATE DATABASE ${ident(dbName)}`);

  const sequelize = new Sequelize(urlFor(dbName), { logging: false, pool: { max: 2 } });
  await migration.up(sequelize.getQueryInterface(), Sequelize);

  const su = new Client({ connectionString: urlFor(dbName) });
  await su.connect();
  await su.query(`CREATE ROLE ${ident(roles.owner)} NOLOGIN`);
  if (ownership) for (const sql of ownershipStatements(roles.owner)) await su.query(sql);
  for (const kind of ['caller', 'gateway', 'admin', 'inspector', 'app']) {
    await su.query(`CREATE ROLE ${ident(roles[kind])} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${password}'`);
    if (kind === 'app') {
      await su.query(`GRANT CONNECT ON DATABASE ${ident(dbName)} TO ${ident(roles.app)}`);
      await su.query(`GRANT USAGE ON SCHEMA public TO ${ident(roles.app)}`);
    } else {
      for (const sql of grants.grantStatements(kind, roles[kind], dbName)) await su.query(sql);
    }
  }

  const pools = {};
  for (const kind of ['caller', 'gateway', 'admin', 'inspector', 'app']) {
    pools[kind] = new Pool({ connectionString: urlFor(dbName, roles[kind], password), max: poolMax });
    pools[kind].on('error', (err) => console.error(`[aigw test] pool ${kind}: ${err.message}`));
  }

  async function close() {
    await Promise.all(Object.values(pools).map((p) => p.end().catch((err) => console.error(`[aigw test] pool end: ${err.message}`))));
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
    tag, dbName, roles, password, sequelize, su, pools,
    port: (kind) => portOf(pools[kind]),
    url: (kind) => (kind === 'su' ? urlFor(dbName) : urlFor(dbName, roles[kind], password)),
    close,
  };
}

module.exports = { ADMIN_URL, shouldSkip, createAigwTestDb, ownershipStatements, urlFor, ident };
