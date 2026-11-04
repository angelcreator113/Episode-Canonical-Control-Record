/**
 * Opt-in gate for debug and seed endpoints (Evoni: "Disable by default and
 * require explicit authorization for any diagnostic access").
 *
 * A route family is mounted only when its flag is exactly 'true', and never
 * when NODE_ENV is 'production', flag or not. A server started without
 * NODE_ENV therefore mounts nothing. Mounted routes still sit behind
 * requireAuth + authorize(['ADMIN']) in app.js.
 *
 *   ENABLE_DEBUG_ROUTES=true  -> /api/v1/debug/env, /debug/data-check, /debug/routes
 *   ENABLE_SEED_ROUTES=true   -> /api/v1/seed/*
 */

const DIAGNOSTIC_FLAGS = Object.freeze(['ENABLE_DEBUG_ROUTES', 'ENABLE_SEED_ROUTES']);

function diagnosticRoutesEnabled(flag, env = process.env) {
  if (!DIAGNOSTIC_FLAGS.includes(flag)) {
    throw new Error(`Unknown diagnostic route flag: ${flag}`);
  }
  if (env[flag] !== 'true') return false;
  if (env.NODE_ENV === 'production') {
    console.warn(`[diagnosticRoutes] ${flag}=true ignored: these routes never mount when NODE_ENV=production`);
    return false;
  }
  return true;
}

module.exports = { diagnosticRoutesEnabled, DIAGNOSTIC_FLAGS };
