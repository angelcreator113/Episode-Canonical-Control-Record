'use strict';

/**
 * Line identity storage (architecture A1b; Evoni, 2026-10-26,
 * docs/reads/2026-10-26-architecture-vs-gameplay-director-rev5.md R2.1,
 * R3.1, R3.9). The keys utils/lineKeys.js keeps for the one script, beside
 * the text they describe, in the same row:
 *
 *   episodes.script_line_keys                 JSONB NULL
 *   episode_script_versions.script_line_keys  JSONB NULL
 *     { v, text_hash, lines: [{ k, b, h }], retired: [{ k, b, h, retired_in }] }
 *
 * Nullable, no default and no backfill: every episode and saved version
 * reads as unkeyed (lineKeys.checkLineKeys) until A1c's one save path keys
 * it. Nothing reads or writes the columns yet; the models leave them out of
 * every default query and every JSON response.
 *
 * Needs 20261015100000-create-episode-script-versions. Migrations run in
 * name order, so a deploy that has not run it yet runs it first; if its
 * table is still missing (it was recorded as run but the table is gone),
 * this refuses rather than adding half the storage. Added columns, so no
 * deleted_at (both tables have their own). Guarded: each is added only when
 * absent. down drops both and nothing else.
 *
 * Runs only through Evoni's Deploy workflow, which migrates before it
 * restarts the API.
 */

const COLUMN = 'script_line_keys';
const TABLES = ['episodes', 'episode_script_versions'];

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = :table",
    { replacements: { table }, transaction });
  return rows.length > 0;
};

const columnExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = :table AND column_name = :column',
    { replacements: { table, column: COLUMN }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const table of TABLES) {
        if (!(await tableExists(sequelize, table, transaction))) {
          throw new Error(`20261026190000: table ${table} does not exist; 20261015100000-create-episode-script-versions must have run first`);
        }
      }
      for (const table of TABLES) {
        if (!(await columnExists(sequelize, table, transaction))) {
          await queryInterface.addColumn(table, COLUMN, { type: Sequelize.JSONB, allowNull: true }, { transaction });
        }
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const table of TABLES) {
        if ((await tableExists(sequelize, table, transaction)) && (await columnExists(sequelize, table, transaction))) {
          await queryInterface.removeColumn(table, COLUMN, { transaction });
        }
      }
    });
  },
};
