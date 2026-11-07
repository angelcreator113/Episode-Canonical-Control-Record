'use strict';

/**
 * Issue #3714: whether the episode worker may run, decided before any module
 * that touches the database, Redis or an AI provider is loaded.
 *
 *   GENERATION_WORKER_ENABLED  must be exactly "true" (case and surrounding
 *                              spaces ignored) for the worker to run. Unset or
 *                              anything else: disabled. A disabled worker
 *                              loads no model, runs no boot recovery, polls
 *                              nothing, registers no Bull consumer and makes
 *                              no AI call; it only waits for a signal.
 *
 * Production (WORKER_DB_REQUIRED is "true", which the production ecosystem
 * sets, or NODE_ENV is production), Option B:
 *   - no database password may be in the environment (WORKER_DB_PASSWORD,
 *     DB_PASSWORD, DATABASE_URL, PGPASSWORD). One there means a stale pm2
 *     saved env or .env line: refuse (exit 78), even when disabled, so it is
 *     noticed and removed;
 *   - when enabled, the login is read from WORKER_DB_CREDENTIALS_FILE
 *     (src/workers/workerCredentials.js: regular file, no symlink, owned by
 *     the worker's user, mode 600). Missing, unsafe, incomplete or the
 *     postgres login: refuse (exit 78). There is no fallback to the API's
 *     login or to postgres;
 *   - NODE_ENV must be production, the only config that reads the held login.
 * The login is returned to start.js, which holds it in memory
 * (src/config/dbCredentials.js); it is never written to process.env, so no
 * child process (FFmpeg) inherits it.
 *
 * Outside production the worker keeps using the existing DB_* settings.
 */

const { readCredentialFile, CredentialFileError, DEFAULT_CREDENTIALS_FILE } = require('./workerCredentials');

// EX_CONFIG (sysexits.h). The production ecosystem lists it in
// stop_exit_codes, so pm2 does not restart a worker refused for its settings.
const EXIT_CONFIG = 78;

// Environment keys that must not carry a database login in production.
const FORBIDDEN_ENV_SECRETS = ['WORKER_DB_PASSWORD', 'DB_PASSWORD', 'DATABASE_URL', 'PGPASSWORD'];

function isRequired(env) {
  return String(env.WORKER_DB_REQUIRED || '').trim().toLowerCase() === 'true' || env.NODE_ENV === 'production';
}

function decideStartup(env = process.env, opts = {}) {
  const required = isRequired(env);

  if (required) {
    const present = FORBIDDEN_ENV_SECRETS.filter((k) => String(env[k] || '') !== '');
    if (present.length) {
      return {
        action: 'refuse',
        message: `Refusing to start: a database password is in the worker's environment (${present.join(', ')}). In production the worker's login is read only from its credential file; remove the value from .env / the pm2 saved env (docs/runbooks/episode-worker-db.md §6).`,
      };
    }
  }

  if (String(env.GENERATION_WORKER_ENABLED || '').trim().toLowerCase() !== 'true') {
    return {
      action: 'disabled',
      message: 'Generation worker is disabled (GENERATION_WORKER_ENABLED is not "true"): no database, queue or AI work will run.',
    };
  }

  if (!required) {
    // Development: the worker keeps using DB_* as before.
    return { action: 'run', identity: 'shared', credentials: null };
  }

  if (env.NODE_ENV !== 'production') {
    return { action: 'refuse', message: 'Refusing to start: the worker\'s own login is used only with NODE_ENV=production.' };
  }

  const file = String(env.WORKER_DB_CREDENTIALS_FILE || '').trim() || DEFAULT_CREDENTIALS_FILE;
  let credentials;
  try {
    credentials = readCredentialFile(file, { uid: opts.uid, fs: opts.fs });
  } catch (err) {
    if (!(err instanceof CredentialFileError)) {
      console.error('[workerStartup] credential file check failed unexpectedly:', err.code || err.name);
      return { action: 'refuse', message: 'Refusing to start: the credential file could not be read.' };
    }
    return { action: 'refuse', message: `Refusing to start: ${err.message}.` };
  }

  return { action: 'run', identity: 'worker', credentials };
}

/**
 * Remove every database login key from the worker's environment (all empty
 * by now in production; this drops even the empty keys, so a child process
 * sees none of them).
 */
function scrubDbEnv(env) {
  for (const k of [...FORBIDDEN_ENV_SECRETS, 'DB_USER', 'DB_USERNAME', 'WORKER_DB_USER']) delete env[k];
}

module.exports = { decideStartup, scrubDbEnv, isRequired, EXIT_CONFIG, FORBIDDEN_ENV_SECRETS };
