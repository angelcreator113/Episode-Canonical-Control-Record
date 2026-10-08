'use strict';

/**
 * Locked script beats (Evoni, 2026-10-08: "yes start with lock then drag
 * and drop"). Approving a beat on the Script tab locks it; the lock was
 * only in the page's memory and was gone on reload, and Regenerate
 * replaced approved beats with the rest.
 *
 * episodes.script_locked_beats (JSONB, nullable): the locked beat numbers,
 * e.g. [2, 5]. Written by PUT /api/v1/episodes/:id/script-locks; read by
 * every writer that replaces the whole script (utils/scriptBeatLocks.js).
 * No backfill: nothing was ever locked.
 *
 * Guarded: the column is added only when absent, so a re-run changes
 * nothing. down drops the column.
 */

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

const hasColumn = async (sequelize, transaction) => {
  const [cols] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'episodes' AND column_name = 'script_locked_beats'`,
    { transaction });
  return cols.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'episodes', transaction))) return;
      if (!(await hasColumn(sequelize, transaction))) {
        await queryInterface.addColumn('episodes', 'script_locked_beats', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, 'episodes') && await hasColumn(sequelize)) {
      await queryInterface.removeColumn('episodes', 'script_locked_beats');
    }
  },
};
