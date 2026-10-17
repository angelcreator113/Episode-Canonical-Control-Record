'use strict';

/**
 * feed_posts.tags: Evoni's own labels on a post (Studio, Design Process,
 * BTS), edited in Admin › The Pulse › Story Clock (Evoni, 2026-10-17: "Add
 * real tags"). A JSON list of short strings, empty by default; any post may
 * carry them, live ones too (src/utils/postTags.js keeps them tidy).
 *
 * Guarded: the column is added only when absent; down drops it.
 */

const TABLE = 'feed_posts';
const COLUMN = 'tags';

const columnExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table: TABLE, column: COLUMN }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, transaction)) return;
      await queryInterface.addColumn(TABLE, COLUMN, {
        type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb"),
      }, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, transaction))) return;
      await queryInterface.removeColumn(TABLE, COLUMN, { transaction });
    });
  },
};
