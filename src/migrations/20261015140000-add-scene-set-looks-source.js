'use strict';

/**
 * scene_set_looks.source: how an event's look was made, 'generated' (an
 * edit of the venue's everyday look, as before) or 'uploaded' (Evoni's own
 * image; Evoni, 2026-10-15: "Each venue needs its everyday look and then
 * its event look", with the event look uploadable as well as generated).
 *
 * Existing rows were all generated, so the column defaults to 'generated'.
 * Guarded: added only when absent. down drops it.
 */

const TABLE = 'scene_set_looks';
const COLUMN = 'source';

const columnExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table: TABLE, column: COLUMN }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, transaction)) return;
      await queryInterface.addColumn(TABLE, COLUMN, {
        type: Sequelize.STRING(20), allowNull: false, defaultValue: 'generated',
      }, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await columnExists(sequelize)) await queryInterface.removeColumn(TABLE, COLUMN);
  },
};
