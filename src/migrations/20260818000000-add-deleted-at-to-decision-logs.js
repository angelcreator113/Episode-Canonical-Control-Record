'use strict';

/**
 * F-AUTH-1 — add `deleted_at` to `decision_logs`.
 *
 * Authorized at Fix Plan v2.54 §1. FD-66 Axis P, one of nineteen; this
 * migration addresses exactly one of them and nothing else.
 *
 * WHY: src/config/sequelize.js:63 sets `paranoid: true` as a global define
 * default. src/models/DecisionLog.js does not opt out, so every query the
 * model issues names `deleted_at`. The table was created at
 * 20260208110001-create-decision-logs-table.js without the column, and no
 * later migration added it — so POST /api/v1/decision-logs has returned 500
 * (`column "deleted_at" does not exist`) since the table existed.
 *
 * NO `defaultValue`, DELIBERATELY — v2.54 §1.3.1. Sequelize implements
 * `paranoid` by appending `deleted_at IS NULL` to the WHERE clause of every
 * read. A default here would not mark rows deleted in any visible way: it
 * would make every existing row vanish from every application query while
 * remaining physically present in the table. No error, no constraint
 * violation, and `defaultValue: Sequelize.NOW` beside a timestamp column
 * reads as ordinary boilerplate in review. NULL is the meaning of
 * "not deleted"; do not add a default here, and do not let a template add one.
 *
 * Shape read from tables that work, not from convention: DATE + allowNull,
 * per 20240101000001-create-episodes.js:112-115 and three others, materialized
 * as `timestamp with time zone`, nullable, no default across all 70 tables
 * carrying the column.
 *
 * GUARDED, Task #1942 (Evoni's ruling (b), 2026-09-26): skips when
 * `decision_logs` is absent, as it is in production, and when the column is
 * already there. It has never run in production, so it is edited in place
 * rather than superseded. Where it has run (CI, and local databases built
 * from the migrations, which have the table) the guarded version does the
 * same thing, so their SequelizeMeta rows stay true.
 */
const TABLE = 'decision_logs';
const LOG = '[migration 20260818000000]';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Task #1942. Production never had decision_logs: its create migration,
    // 20260208110001-create-decision-logs-table.js, was recorded in
    // SequelizeMeta by scripts/bootstrap-sequelize-meta.js without running
    // (docs/MIGRATION_DRIFT_READ.md §2). The unguarded addColumn failed there
    // and stopped every later migration. Where the table is absent this now
    // logs and returns; where it exists (CI, a local database built from the
    // migrations) it adds the column as before. The working table is
    // decision_log (singular), which this file does not touch.
    if (!(await queryInterface.tableExists(TABLE))) {
      console.warn(`${LOG} ${TABLE} does not exist here; nothing to add deleted_at to. Skipped (Task #1942).`);
      return;
    }
    const columns = await queryInterface.describeTable(TABLE);
    if (columns.deleted_at) {
      console.log(`${LOG} ${TABLE}.deleted_at already exists; nothing to do.`);
      return;
    }
    await queryInterface.addColumn(TABLE, 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    if (!(await queryInterface.tableExists(TABLE))) {
      console.warn(`${LOG} ${TABLE} does not exist here; nothing to remove.`);
      return;
    }
    const columns = await queryInterface.describeTable(TABLE);
    if (!columns.deleted_at) {
      console.warn(`${LOG} ${TABLE}.deleted_at does not exist here; nothing to remove.`);
      return;
    }
    await queryInterface.removeColumn(TABLE, 'deleted_at');
  },
};
