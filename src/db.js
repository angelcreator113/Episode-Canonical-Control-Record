/**
 * The legacy raw-SQL handle (icon cues, cursor paths, music cues,
 * production packages, icon slots, composition versions and filters).
 *
 * It used to open its own pg Pool with no SSL and with built-in fallback
 * credentials, so in production every query failed at connect ("no
 * pg_hba.conf entry ... no encryption"). It now hands out the app's shared,
 * SSL-aware pool from src/config/database.js (getPool: DATABASE_URL or the
 * DB_* settings, SSL when DB_SSL=true) and has no credentials of its own.
 *
 * The pool is resolved on each call, so requiring this file opens nothing.
 */
const { getPool } = require('./config/database');

const pool = {
  query: (...args) => getPool().query(...args),
  connect: (...args) => getPool().connect(...args),
};

module.exports = {
  pool,
  query: (text, params) => getPool().query(text, params),
};
