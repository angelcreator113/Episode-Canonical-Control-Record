'use strict';

/**
 * The cast's review of the old system (Evoni's mock, 2026-10-08: "From the
 * old system" with To review / Kept / Archived). Keep had nowhere to live.
 *
 * registry_characters.cast_review (VARCHAR(20), nullable): 'kept' when
 * Evoni keeps an old-system character; NULL is still to review. Archived
 * is the row's existing soft delete (deleted_at), not a value here.
 * registry_characters.cast_reviewed_at (timestamptz, nullable): when.
 * Written by POST /api/v1/cast/characters/:id/keep (routes/castRoutes.js).
 * No backfill: nothing was reviewed.
 *
 * Guarded: each column is added only when absent, so a re-run changes
 * nothing. down drops them.
 */

const TABLE = 'registry_characters';
const COLUMNS = ['cast_review', 'cast_reviewed_at'];

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${TABLE}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

const hasColumn = async (sequelize, column, transaction) => {
  const [cols] = await sequelize.query(
    'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column',
    { replacements: { table: TABLE, column }, transaction });
  return cols.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const defs = {
      cast_review: { type: Sequelize.STRING(20), allowNull: true },
      cast_reviewed_at: { type: Sequelize.DATE, allowNull: true },
    };
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      for (const column of COLUMNS) {
        if (!(await hasColumn(sequelize, column, transaction))) {
          await queryInterface.addColumn(TABLE, column, defs[column], { transaction });
        }
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize))) return;
    for (const column of COLUMNS) {
      if (await hasColumn(sequelize, column)) await queryInterface.removeColumn(TABLE, column);
    }
  },
};
