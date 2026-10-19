'use strict';

/**
 * pulse_follows: who follows whom on The Pulse (Evoni, 2026-10-19: "we need
 * a follow system"). One row is one person following another, one way:
 * "Maren follows Lala" says nothing about Lala following Maren. Two people
 * who follow each other are friends; there is no separate befriending.
 *
 *   follower_profile_id   the Pulse profile doing the following (social_profiles)
 *   followed_profile_id   the Pulse profile followed
 *   source                auto_feed     came from the feed, follows Lala on crossing
 *                         evoni         set by hand on their Pulse profile
 *                         seed_friends  a friend of Lala's before follows existed
 *   created_by            who or what made it
 *
 * The audience numbers (pulse_followers, social_profiles.follower_count_approx)
 * stay apart: these are follows between named people, not Lala's 900K
 * (Evoni, 2026-10-19). Not to be confused with social_profile_followers (the
 * automatic follow engine) or social_profile_relationships (collab, rival…).
 *
 * New table only, with deleted_at. Guarded: created only when absent. down
 * drops it.
 */

const TABLE = 'pulse_follows';

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
        follower_profile_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'social_profiles', key: 'id' }, onDelete: 'CASCADE' },
        followed_profile_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'social_profiles', key: 'id' }, onDelete: 'CASCADE' },
        source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'evoni' },
        created_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE} ADD CONSTRAINT pulse_follows_not_self CHECK (follower_profile_id <> followed_profile_id),
           ADD CONSTRAINT pulse_follows_source CHECK (source IN ('auto_feed', 'evoni', 'seed_friends'))`, { transaction });
      // One live follow per pair and direction; unfollowing soft-deletes it.
      await sequelize.query(
        `CREATE UNIQUE INDEX pulse_follows_one_live ON ${TABLE} (follower_profile_id, followed_profile_id)
          WHERE deleted_at IS NULL`, { transaction });
      await queryInterface.addIndex(TABLE, ['followed_profile_id'], { name: 'pulse_follows_followed', transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
