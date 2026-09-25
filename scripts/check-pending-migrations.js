#!/usr/bin/env node
/* eslint-disable no-console */
// scripts/check-pending-migrations.js
//
// Read-only pre-restart check for the manual deploy (Task: #1862).
// Lists every src/migrations/*.js file that has no row in "SequelizeMeta",
// in the order sequelize-cli would run them (sorted by basename).
//
// Usage (from anywhere; it runs against the repo root's .env):
//   node scripts/check-pending-migrations.js
//   node scripts/check-pending-migrations.js --report-only
//
// Exit codes:
//   0  nothing pending (prints the number of files checked)
//      --report-only: also 0 when files are pending (the list still prints)
//   1  one or more files pending (do not restart)
//   2  connection, query or permission error (printed) - the ledger could
//      not be read, which is never treated as "nothing pending"
//
// Connection: dotenv .env plus the src/config/sequelize.js block for the
// current NODE_ENV (SSL settings included), the same fields src/models/index.js
// passes to Sequelize. The only statement sent is
//   SELECT name FROM "SequelizeMeta"
// No DDL, no CREATE TABLE IF NOT EXISTS (unlike `npm run migrate:status`).
// Ledger rows with no matching file are ignored.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'src', 'migrations');
const LEDGER_QUERY = 'SELECT name FROM "SequelizeMeta"';

/** Basenames of src/migrations/*.js, sorted (sequelize-cli run order). */
function listMigrationFiles(dir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort();
}

/**
 * Core check. No I/O besides the injected query and loggers.
 * @param {object} opts
 * @param {string[]} opts.files       migration basenames
 * @param {() => Promise<string[]>} opts.queryNames  returns SequelizeMeta names
 * @param {boolean} [opts.reportOnly]
 * @param {(msg: string) => void} [opts.log]
 * @param {(msg: string) => void} [opts.errorLog]
 * @returns {Promise<number>} exit code (0, 1 or 2)
 */
async function checkPendingMigrations({
  files,
  queryNames,
  reportOnly = false,
  log = console.log,
  errorLog = console.error,
}) {
  let names;
  try {
    names = await queryNames();
    if (!Array.isArray(names)) {
      throw new Error('ledger query returned no row list');
    }
  } catch (err) {
    errorLog(`[pending-migrations] ERROR: could not read "SequelizeMeta": ${err && err.message ? err.message : err}`);
    errorLog('[pending-migrations] The ledger was not read; pending state is UNKNOWN. Do not restart.');
    return 2;
  }

  // sequelize-cli records the basename with its extension; accept a row
  // without ".js" too. Rows with no file in the tree are ignored.
  const recorded = new Set();
  for (const n of names) {
    const s = String(n);
    recorded.add(s);
    recorded.add(s.endsWith('.js') ? s : `${s}.js`);
  }

  const ordered = [...files].sort();
  const pending = ordered.filter((f) => !recorded.has(f));

  if (pending.length === 0) {
    log(`[pending-migrations] OK: 0 pending of ${ordered.length} migration files checked.`);
    return 0;
  }

  log(`[pending-migrations] ${pending.length} pending of ${ordered.length} migration files checked (run order):`);
  for (const f of pending) log(`  ${f}`);

  if (reportOnly) {
    log('[pending-migrations] --report-only: exiting 0 despite pending files.');
    return 0;
  }
  log('[pending-migrations] FAIL: pending migrations. Do not restart.');
  return 1;
}

/** Ledger reader built from the app's own config block for NODE_ENV. */
function buildLedgerReader() {
  let sequelize = null;
  const queryNames = async () => {
    // Loading the config runs dotenv against the repo root .env (cwd set by main()).
    const { Sequelize, QueryTypes } = require('sequelize');
    const config = require('../src/config/sequelize');
    const env = process.env.NODE_ENV || 'development';
    const dbConfig = config[env];
    if (!dbConfig) throw new Error(`no database config for NODE_ENV=${env}`);

    // Same fields src/models/index.js passes; a one-connection pool.
    sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      logging: false,
      pool: { max: 1, min: 0, acquire: 30000, idle: 1000 },
      dialectOptions: { ...dbConfig.dialectOptions, client_encoding: 'UTF8' },
      retry: dbConfig.retry,
    });
    const rows = await sequelize.query(LEDGER_QUERY, { type: QueryTypes.SELECT });
    return rows.map((r) => r.name);
  };
  const close = async () => {
    if (sequelize) await sequelize.close();
  };
  return { queryNames, close };
}

async function main(argv = process.argv.slice(2)) {
  const reportOnly = argv.includes('--report-only');
  process.chdir(REPO_ROOT);

  let files;
  try {
    files = listMigrationFiles();
  } catch (err) {
    console.error(`[pending-migrations] ERROR: could not list ${MIGRATIONS_DIR}: ${err.message}`);
    return 2;
  }

  const { queryNames, close } = buildLedgerReader();
  let code;
  try {
    code = await checkPendingMigrations({ files, queryNames, reportOnly });
  } finally {
    try {
      await close();
    } catch (err) {
      console.error(`[pending-migrations] warning: closing the connection failed: ${err.message}`);
    }
  }
  return code;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`[pending-migrations] ERROR: ${err && err.stack ? err.stack : err}`);
      process.exit(2);
    }
  );
}

module.exports = { checkPendingMigrations, listMigrationFiles, main, LEDGER_QUERY };
