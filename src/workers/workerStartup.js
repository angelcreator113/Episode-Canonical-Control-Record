'use strict';

/**
 * Issue #3714: whether the episode worker may run, decided from its
 * environment alone, before any module that touches the database, Redis or
 * an AI provider is loaded.
 *
 *   GENERATION_WORKER_ENABLED  must be exactly "true" for the worker to run.
 *                              Unset or anything else: disabled. A disabled
 *                              worker loads no model, runs no boot recovery,
 *                              polls nothing, registers no Bull consumer and
 *                              makes no AI call; it only waits for a signal.
 *   WORKER_DB_USER /           the worker's own database login. Required when
 *   WORKER_DB_PASSWORD         WORKER_DB_REQUIRED is "true" (the production
 *                              ecosystem sets it) or NODE_ENV is production.
 *                              There is no fallback to the API's DB_USER /
 *                              DB_PASSWORD or to postgres: missing values,
 *                              or the postgres login, refuse to start (exit
 *                              code 78). Outside production, when they are
 *                              not set, the existing DB_* settings are used
 *                              as before (local development, the dev box).
 */

// EX_CONFIG (sysexits.h). The production ecosystem lists it in
// stop_exit_codes, so pm2 does not restart a worker refused for its settings.
const EXIT_CONFIG = 78;

const MASTER_LOGINS = new Set(['postgres', 'rdsadmin']);

function decideStartup(env = process.env) {
  if (String(env.GENERATION_WORKER_ENABLED || '').trim().toLowerCase() !== 'true') {
    return {
      action: 'disabled',
      message: 'Generation worker is disabled (GENERATION_WORKER_ENABLED is not "true"): no database, queue or AI work will run.',
    };
  }

  const required = String(env.WORKER_DB_REQUIRED || '').trim().toLowerCase() === 'true' || env.NODE_ENV === 'production';
  const user = String(env.WORKER_DB_USER || '').trim();
  const password = env.WORKER_DB_PASSWORD || '';

  if (!user || !password) {
    if (required) {
      return {
        action: 'refuse',
        message: `Refusing to start: WORKER_DB_USER and WORKER_DB_PASSWORD must both be set (missing: ${[!user && 'WORKER_DB_USER', !password && 'WORKER_DB_PASSWORD'].filter(Boolean).join(', ')}). The worker never falls back to the API's or the postgres login.`,
      };
    }
    // Development: the worker keeps using DB_* as before.
    return { action: 'run', identity: 'shared', dbEnv: null };
  }

  if (MASTER_LOGINS.has(user.toLowerCase())) {
    return { action: 'refuse', message: `Refusing to start: WORKER_DB_USER is the master login (${user}); the worker runs as its own least-privilege role.` };
  }

  return {
    action: 'run',
    identity: 'worker',
    // Applied to process.env before the models load: config/sequelize.js
    // reads DB_USER / DB_PASSWORD. DATABASE_URL is removed so no other login
    // can be picked up by a non-production config.
    dbEnv: { DB_USER: user, DB_PASSWORD: password },
  };
}

function applyDbEnv(env, dbEnv) {
  if (!dbEnv) return;
  env.DB_USER = dbEnv.DB_USER;
  env.DB_PASSWORD = dbEnv.DB_PASSWORD;
  delete env.DB_USERNAME;
  delete env.DATABASE_URL;
}

module.exports = { decideStartup, applyDbEnv, EXIT_CONFIG };
