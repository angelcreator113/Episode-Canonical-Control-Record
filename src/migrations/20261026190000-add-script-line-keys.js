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
 * absent, and a column already there must be nullable JSONB (Evoni,
 * 2026-10-26); any other definition, on either table, refuses the whole
 * migration before anything is added. down drops both and nothing else.
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

// The column as it stands: { data_type, is_nullable } or null when absent.
const columnDefinition = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query(
    'SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = :table AND column_name = :column',
    { replacements: { table, column: COLUMN }, transaction });
  return rows[0] || null;
};

const columnExists = async (sequelize, table, transaction) => Boolean(await columnDefinition(sequelize, table, transaction));

const compatible = (def) => def.data_type === 'jsonb' && def.is_nullable === 'YES';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const table of TABLES) {
        if (!(await tableExists(sequelize, table, transaction))) {
          const needs = table === 'episode_script_versions' ? '; 20261015100000-create-episode-script-versions must have run first' : '';
          throw new Error(`20261026190000: table ${table} does not exist${needs}`);
        }
      }
      // Every existing column is checked before anything is added.
      const missing = new Set();
      for (const table of TABLES) {
        const def = await columnDefinition(sequelize, table, transaction);
        if (!def) { missing.add(table); continue; }
        if (!compatible(def)) {
          throw new Error(`20261026190000: ${table}.${COLUMN} already exists as ${def.data_type}${def.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'}; expected jsonb NULL. Nothing was changed.`);
        }
      }
      // Named one by one so scripts/check-schema-agreement.js reads them.
      if (missing.has('episodes')) {
        await queryInterface.addColumn('episodes', COLUMN, { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
      if (missing.has('episode_script_versions')) {
        await queryInterface.addColumn('episode_script_versions', COLUMN, { type: Sequelize.JSONB, allowNull: true }, { transaction });
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
