'use strict';

/**
 * feed_posts.status (the Feed project, step 2, 2026-10-04;
 * src/services/feedPostStatus.js, docs/FEED_POSTS.md).
 *
 *   'draft' — written, not on the feed; editable.
 *   'live'  — on the feed; never edited again, only deleted.
 *
 * Every existing post is already on the feed, so the column defaults to
 * 'live' and the backfill is the default. A check constraint keeps the
 * two values; an index serves the feed's live-by-show reads. Guarded;
 * down removes the index, the constraint and the column.
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
      if (!(await columnExists(sequelize, 'status', transaction))) {
        await queryInterface.addColumn(TABLE, 'status',
          { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'live' }, { transaction });
      }
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${TABLE}_status_check`, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE} ADD CONSTRAINT ${TABLE}_status_check CHECK (status IN ('draft', 'live'))`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_show_status ON ${TABLE} (show_id, status) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`DROP INDEX IF EXISTS ${TABLE}_show_status`, { transaction });
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${TABLE}_status_check`, { transaction });
      if (await columnExists(sequelize, 'status', transaction)) await queryInterface.removeColumn(TABLE, 'status', { transaction });
    });
  },
};
