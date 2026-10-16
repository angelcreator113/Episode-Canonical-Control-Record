'use strict';

/**
 * Post weight (Character Consistency Engine, step 4; Evoni, 2026-10-16:
 * "yes start step 4"; services/characterPosts).
 *
 *   feed_posts.post_weight      'load_bearing' (the story reacts to it; it
 *                               must exist before its beat locks) or
 *                               'ambient' (flavor; can sit at any beat).
 *                               Null on every post drafted before this.
 *   feed_posts.post_weight_why  for a load-bearing post, what in the story
 *                               reacts to it, in one line.
 *
 * Each column is added only when missing and tagged, so down drops only
 * what this migration added.
 */

const TABLE = 'feed_posts';
const MARK = 'added by 20261016150000-feed-post-weight';
const CHECK = 'feed_posts_post_weight_check';

const exists = async (sequelize, sql, replacements, transaction) => (await sequelize.query(sql, { replacements, transaction }))[0].length > 0;
const tableExists = (sequelize, name, t) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name }, t);
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
      if (!(await tableExists(sequelize, TABLE, transaction))) return;
      if (!(await columnExists(sequelize, 'post_weight', transaction))) {
        await queryInterface.addColumn(TABLE, 'post_weight', { type: Sequelize.STRING(16), allowNull: true }, { transaction });
        await sequelize.query(`COMMENT ON COLUMN ${TABLE}.post_weight IS '${MARK}'`, { transaction });
        await sequelize.query(
          `ALTER TABLE ${TABLE} ADD CONSTRAINT ${CHECK} CHECK (post_weight IS NULL OR post_weight IN ('load_bearing', 'ambient'))`,
          { transaction });
      }
      if (!(await columnExists(sequelize, 'post_weight_why', transaction))) {
        await queryInterface.addColumn(TABLE, 'post_weight_why', { type: Sequelize.TEXT, allowNull: true }, { transaction });
        await sequelize.query(`COMMENT ON COLUMN ${TABLE}.post_weight_why IS '${MARK}'`, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, TABLE, transaction))) return;
      if (await columnExists(sequelize, 'post_weight_why', transaction) && await ourColumn(sequelize, 'post_weight_why', transaction)) {
        await queryInterface.removeColumn(TABLE, 'post_weight_why', { transaction });
      }
      if (await columnExists(sequelize, 'post_weight', transaction) && await ourColumn(sequelize, 'post_weight', transaction)) {
        await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${CHECK}`, { transaction });
        await queryInterface.removeColumn(TABLE, 'post_weight', { transaction });
      }
    });
  },
};
