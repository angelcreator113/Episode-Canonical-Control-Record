'use strict';

/**
 * pulse_fits.story_order (Task #2937; The Pulse spec §3 "Latest fit",
 * §12 step 4; src/services/storyClock.js): the story time a fit was
 * uploaded at, stamped like a wall post's feed_posts.story_order (after
 * the show's latest published episode), so the latest fit follows the
 * story clock and the scrubber can show it as of any story moment.
 * Nullable integer: fits uploaded before this column have unknown story
 * time. Guarded; down removes it.
 */

const TABLE = 'pulse_fits';

const columnExists = async (sequelize, column, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table: TABLE, column }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, 'story_order', transaction))) {
        await queryInterface.addColumn(TABLE, 'story_order', { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, 'story_order', transaction)) await queryInterface.removeColumn(TABLE, 'story_order', { transaction });
    });
  },
};
