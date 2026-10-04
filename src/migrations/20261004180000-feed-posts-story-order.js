'use strict';

/**
 * feed_posts.story_order (the Feed project, docs/FEED_POSTS.md rule 9,
 * 2026-10-04; src/services/storyClock.js): the story time a post written
 * on the wall, with no episode, was stamped with when written (episode
 * number * 10 + phase). A post with an episode takes its story time from
 * that episode and its timeline_position, so the column stays NULL for
 * those, and for older wall posts, whose story time is unknown. Nullable
 * integer; guarded; down removes it.
 */

const TABLE = 'feed_posts';

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
