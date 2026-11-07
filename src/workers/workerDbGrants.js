'use strict';

/**
 * Issue #3714: the database privileges the production `episode-worker`
 * needs, and nothing more. One source for:
 *   - scripts/db/sql/episode-worker-role.sql (the role Evoni creates by hand;
 *     tests/unit/workers/workerDbGrants.test.js checks the file matches);
 *   - scripts/worker/check-db-access.js (the read-only preflight);
 *   - tests/integration/workerRestrictedRole.integration.test.js.
 *
 * Traced from src/workers/start.js (2026-11-07, at 75e96a5a): the video
 * renderer makes no database call; the scene-generation path reads and
 * writes these tables only, never DELETE, TRUNCATE or DDL.
 *   generation_jobs  boot recovery (recoverStuckJobs), the claim
 *                    (SELECT ... FOR UPDATE SKIP LOCKED), job updates
 *   scene_sets       job reads and updates; boot recovery of a cascade
 *   scene_angles     job reads and updates; the angle claim (claimRow)
 *   world_locations  the scene brief and the approved-base check (read)
 *   world_events     the scene brief (read)
 *   ai_usage_logs    today's spend (aiCostTracker at load, imageCostService
 *                    before each image call) and one row per call; its id
 *                    is serial, so the sequence needs USAGE.
 * A row lock (FOR UPDATE) needs UPDATE on the table, which it has.
 */

const WORKER_ROLE = 'episode_worker';

const TABLE_GRANTS = Object.freeze({
  generation_jobs: Object.freeze(['SELECT', 'UPDATE']),
  scene_sets: Object.freeze(['SELECT', 'UPDATE']),
  scene_angles: Object.freeze(['SELECT', 'UPDATE']),
  world_locations: Object.freeze(['SELECT']),
  world_events: Object.freeze(['SELECT']),
  ai_usage_logs: Object.freeze(['SELECT', 'INSERT']),
});

const SEQUENCE_GRANTS = Object.freeze({
  ai_usage_logs_id_seq: Object.freeze(['USAGE']),
});

// Every table privilege Postgres has; the preflight checks the ones not
// granted above are absent.
const TABLE_PRIVILEGES = Object.freeze(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);

// The role's connection limit, and the worker's pool, which stays below it so
// a check or an admin session still fits (CONNECTION LIMIT counts every
// session of the role).
const CONNECTION_LIMIT = 5;
const POOL_MAX = 4;

/**
 * The statements that give `role` exactly these privileges in `database`.
 * Used by the tests to build a restricted role; the production SQL file
 * spells the same statements out (and the unit test compares them).
 */
function grantStatements(role, database) {
  const q = (id) => `"${String(id).replace(/"/g, '""')}"`;
  const out = [
    `GRANT CONNECT ON DATABASE ${q(database)} TO ${q(role)}`,
    `GRANT USAGE ON SCHEMA public TO ${q(role)}`,
  ];
  for (const [table, privs] of Object.entries(TABLE_GRANTS)) {
    out.push(`GRANT ${privs.join(', ')} ON TABLE public.${q(table)} TO ${q(role)}`);
  }
  for (const [seq, privs] of Object.entries(SEQUENCE_GRANTS)) {
    out.push(`GRANT ${privs.join(', ')} ON SEQUENCE public.${q(seq)} TO ${q(role)}`);
  }
  return out;
}

module.exports = {
  WORKER_ROLE,
  TABLE_GRANTS,
  SEQUENCE_GRANTS,
  TABLE_PRIVILEGES,
  CONNECTION_LIMIT,
  POOL_MAX,
  grantStatements,
};
