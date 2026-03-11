'use strict';

/**
 * Fix Amber timestamp columns: rename camelCase → snake_case
 *
 * The original migration (20260310180000) created columns as "createdAt" / "updatedAt",
 * but all three Amber models set `underscored: true`, so Sequelize queries
 * "created_at" / "updated_at" — which don't exist. This renames them.
 */

const TABLES = ['amber_findings', 'amber_scan_runs', 'amber_task_queue'];

module.exports = {
  async up(queryInterface) {
    for (const table of TABLES) {
      // Only rename if the camelCase column exists (idempotent)
      const desc = await queryInterface.describeTable(table).catch(() => null);
      if (!desc) continue;

      if (desc.createdAt && !desc.created_at) {
        await queryInterface.renameColumn(table, 'createdAt', 'created_at');
      }
      if (desc.updatedAt && !desc.updated_at) {
        await queryInterface.renameColumn(table, 'updatedAt', 'updated_at');
      }
    }
  },

  async down(queryInterface) {
    for (const table of TABLES) {
      const desc = await queryInterface.describeTable(table).catch(() => null);
      if (!desc) continue;

      if (desc.created_at && !desc.createdAt) {
        await queryInterface.renameColumn(table, 'created_at', 'createdAt');
      }
      if (desc.updated_at && !desc.updatedAt) {
        await queryInterface.renameColumn(table, 'updated_at', 'updatedAt');
      }
    }
  },
};
