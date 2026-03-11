'use strict';

/**
 * Fix amber_findings, amber_scan_runs, amber_task_queue timestamp columns.
 *
 * The original migration (20260310180000) created these columns as camelCase
 * ("createdAt" / "updatedAt"), but the models use underscored: true, so
 * Sequelize queries "created_at" / "updated_at".  Rename to match.
 */
module.exports = {
  async up(queryInterface) {
    const tables = ['amber_findings', 'amber_scan_runs', 'amber_task_queue'];

    for (const table of tables) {
      // Check if the camelCase columns exist before renaming
      const [cols] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = '${table}' AND column_name IN ('createdAt', 'updatedAt')`,
      );

      if (cols.some(c => c.column_name === 'createdAt')) {
        await queryInterface.renameColumn(table, 'createdAt', 'created_at');
      }
      if (cols.some(c => c.column_name === 'updatedAt')) {
        await queryInterface.renameColumn(table, 'updatedAt', 'updated_at');
      }
    }
  },

  async down(queryInterface) {
    const tables = ['amber_findings', 'amber_scan_runs', 'amber_task_queue'];

    for (const table of tables) {
      const [cols] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = '${table}' AND column_name IN ('created_at', 'updated_at')`,
      );

      if (cols.some(c => c.column_name === 'created_at')) {
        await queryInterface.renameColumn(table, 'created_at', 'createdAt');
      }
      if (cols.some(c => c.column_name === 'updated_at')) {
        await queryInterface.renameColumn(table, 'updated_at', 'updatedAt');
      }
    }
  },
};
