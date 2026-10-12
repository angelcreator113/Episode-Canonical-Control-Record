'use strict';

/**
 * pulse_post_numbers: each live post's proposed and canon likes and shares
 * (Task #2953; The Pulse spec §8 "Each post's likes, comments and shares are
 * proposed when it goes live"; docs/reads/2026-10-12-pulse-numbers-read.md §2).
 * One row per post, written when it goes live (services/pulseNumbers.js).
 * Comments are never proposed: comments_count is the real live comments.
 *
 *   proposed_likes, proposed_shares   from factors_json (followers at the
 *                                     post's story time, post kind, trend,
 *                                     episode result, a random factor)
 *   seed                              fixes the random factor, so the
 *                                     proposal is the same on every read
 *   status       proposed | accepted | adjusted | viral | flop
 *   final_likes, final_shares         the canon numbers once decided
 *   flag         why it waits (lala, about_lala, spike, no_followers)
 *   story_order  the post's story moment when proposed
 *
 * New table only, with deleted_at. Guarded: created only when absent. down
 * drops it.
 */

const TABLE = 'pulse_post_numbers';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) return;
      await queryInterface.createTable(TABLE, {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
        post_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'feed_posts', key: 'id' }, onDelete: 'CASCADE' },
        show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
        social_profile_id: { type: Sequelize.INTEGER, allowNull: true },
        poster_handle: { type: Sequelize.STRING(100), allowNull: true },
        proposed_likes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        proposed_shares: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        factors_json: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        seed: { type: Sequelize.BIGINT, allowNull: false },
        status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'proposed' },
        final_likes: { type: Sequelize.INTEGER, allowNull: true },
        final_shares: { type: Sequelize.INTEGER, allowNull: true },
        reason: { type: Sequelize.TEXT, allowNull: true },
        flag: { type: Sequelize.STRING(20), allowNull: true },
        decided_by: { type: Sequelize.STRING(255), allowNull: true },
        decided_at: { type: Sequelize.DATE, allowNull: true },
        story_order: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      // One proposal per post.
      await sequelize.query(
        `CREATE UNIQUE INDEX pulse_post_numbers_one_per_post ON ${TABLE} (post_id) WHERE deleted_at IS NULL`,
        { transaction });
      await queryInterface.addIndex(TABLE, ['show_id', 'status'], { name: 'pulse_post_numbers_show_status', transaction });
      await queryInterface.addIndex(TABLE, ['show_id', 'social_profile_id'], { name: 'pulse_post_numbers_show_profile', transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) await queryInterface.dropTable(TABLE, { transaction });
    });
  },
};
