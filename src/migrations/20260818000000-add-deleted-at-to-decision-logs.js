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
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('decision_logs', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('decision_logs', 'deleted_at');
  },
};
