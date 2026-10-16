'use strict';

/**
 * Release time (Character Consistency Engine step 6c, the two-clock model;
 * Evoni, 2026-10-16: "yes publish/schedule/hold"; services/postRelease).
 * A post's story time (story_order) places it in the story and the script;
 * its release time is when the audience sees it on The Pulse.
 *
 *   feed_posts.release_state  'scheduled' (goes live at release_at) or
 *                             'held' (waits until Evoni releases it); null
 *                             for an ordinary draft or a live post
 *   feed_posts.release_at     when a scheduled draft goes live
 *
 * Each column is added only when missing and tagged, so down drops only
 * what this migration added.
 */

const TABLE = 'feed_posts';
const MARK = 'added by 20261016180000-feed-post-release-time';
const CHECK = 'feed_posts_release_state_check';

const exists = async (sequelize, sql, replacements, transaction) => (await sequelize.query(sql, { replacements, transaction }))[0].length > 0;
const tableExists = (sequelize, t) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name: TABLE }, t);
const columnExists = (sequelize, column, t) => exists(sequelize,
  'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table: TABLE, column }, t);
const ourColumn = (sequelize, column, t) => exists(sequelize,
  `SELECT 1 FROM pg_description d JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
    WHERE d.objoid = :table::regclass AND a.attname = :column AND d.description = :mark`,
  { table: TABLE, column, mark: MARK }, t);

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      if (!(await columnExists(sequelize, 'release_state', transaction))) {
        await queryInterface.addColumn(TABLE, 'release_state', { type: Sequelize.STRING(12), allowNull: true }, { transaction });
        await sequelize.query(`COMMENT ON COLUMN ${TABLE}.release_state IS '${MARK}'`, { transaction });
        await sequelize.query(
          `ALTER TABLE ${TABLE} ADD CONSTRAINT ${CHECK} CHECK (release_state IS NULL OR release_state IN ('scheduled', 'held'))`,
          { transaction });
      }
      if (!(await columnExists(sequelize, 'release_at', transaction))) {
        await queryInterface.addColumn(TABLE, 'release_at', { type: Sequelize.DATE, allowNull: true }, { transaction });
        await sequelize.query(`COMMENT ON COLUMN ${TABLE}.release_at IS '${MARK}'`, { transaction });
      }
      // The due-scheduled-drafts lookup the release timer runs every minute.
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS feed_posts_release_due_idx ON ${TABLE} (release_at)
          WHERE release_state = 'scheduled' AND status = 'draft' AND deleted_at IS NULL`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await sequelize.query('DROP INDEX IF EXISTS feed_posts_release_due_idx', { transaction });
      if (await columnExists(sequelize, 'release_at', transaction) && await ourColumn(sequelize, 'release_at', transaction)) {
        await queryInterface.removeColumn(TABLE, 'release_at', { transaction });
      }
      if (await columnExists(sequelize, 'release_state', transaction) && await ourColumn(sequelize, 'release_state', transaction)) {
        await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${CHECK}`, { transaction });
        await queryInterface.removeColumn(TABLE, 'release_state', { transaction });
      }
    });
  },
};
