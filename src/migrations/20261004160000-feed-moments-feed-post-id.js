'use strict';

/**
 * feed_moments.feed_post_id (the Feed project, step 3, 2026-10-04;
 * docs/FEED_POSTS.md): a beat's phone moment points at the post it shows
 * (feed_posts.id) instead of carrying a copy of its text. The moment's
 * screen_content stays as the fallback for moments with no post. No
 * foreign key, as the table's other links; an index for the reverse
 * read ("which beats show this post"). Guarded; down removes both.
 */

const TABLE = 'feed_moments';

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
      if (!(await columnExists(sequelize, 'feed_post_id', transaction))) {
        await queryInterface.addColumn(TABLE, 'feed_post_id', { type: Sequelize.UUID, allowNull: true }, { transaction });
      }
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_feed_post_id ON ${TABLE} (feed_post_id) WHERE feed_post_id IS NOT NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`DROP INDEX IF EXISTS ${TABLE}_feed_post_id`, { transaction });
      if (await columnExists(sequelize, 'feed_post_id', transaction)) await queryInterface.removeColumn(TABLE, 'feed_post_id', { transaction });
    });
  },
};
