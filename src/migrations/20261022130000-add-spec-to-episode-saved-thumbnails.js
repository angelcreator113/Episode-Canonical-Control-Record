'use strict';

/**
 * episode_saved_thumbnails.spec: the layers a saved thumbnail was drawn from
 * ({ version: 2, layers }), so a saved one can become the show's template
 * (Evoni, 2026-10-22: "start a template from a saved thumbnail"). Thumbnails
 * saved before this have none.
 *
 * Guarded: added only when the table exists and the column does not. down
 * drops the column.
 */

const TABLE = 'episode_saved_thumbnails';
const COLUMN = 'spec';

const columnState = async (sequelize, transaction) => {
  const [[reg]] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${TABLE}` }, transaction });
  if (!reg || !reg.reg) return 'no-table';
  const [[col]] = await sequelize.query(
    `SELECT 1 AS present FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table: TABLE, column: COLUMN }, transaction });
  return col ? 'present' : 'absent';
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnState(sequelize, transaction) !== 'absent') return;
      await queryInterface.addColumn(TABLE, COLUMN, { type: Sequelize.JSONB, allowNull: true }, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await columnState(sequelize) === 'present') await queryInterface.removeColumn(TABLE, COLUMN);
  },
};
