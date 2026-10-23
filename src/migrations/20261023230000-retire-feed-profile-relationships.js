'use strict';

/**
 * Feed profiles and Pulse profiles are one thing (Evoni, 2026-10-23: "feed
 * profiles and pulse profiles should be the same thing now"), so their
 * relationships live in one table, social_profile_relationships.
 *
 * feed_profile_relationships, the Relationship Map's old table, has not been
 * written since Task #3115: migration 20261013130000 copied its rows into
 * social_profile_relationships and the map edits that table. Here:
 *   1. any row not yet copied is copied, by running 20261013130000's up
 *      again (it skips rows it logged and pairs that already have the kind);
 *   2. the table is dropped, with its enum type. Guarded: a row that is
 *      neither copied nor already in social_profile_relationships (nor a
 *      pair with itself) stops the drop, so nothing is lost silently.
 * map_relationship_copies, the copy log, stays.
 *
 * down recreates feed_profile_relationships empty, as 20260312210000 made it.
 */

const TABLE = 'feed_profile_relationships';
const TYPE = 'enum_feed_profile_relationships_relationship_type';
const FEED_TO_PULSE = {
  collab: 'collab', beef: 'feud', copy_cat: 'copycat', mentor: 'mentor', public_shade: 'shade',
  silent_alliance: 'secret_link', competitors: 'rival', orbit: 'orbit', former_friends: 'former_friends',
};

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, TABLE))) return;
    await require('./20261013130000-map-relationships-into-pulse').up(queryInterface, Sequelize);

    await sequelize.transaction(async (transaction) => {
      const cases = Object.entries(FEED_TO_PULSE).map(([from, to]) => `WHEN '${from}' THEN '${to}'`).join(' ');
      const [[left]] = await sequelize.query(
        `SELECT COUNT(*)::int AS n FROM ${TABLE} fr
          WHERE fr.influencer_a_id <> fr.influencer_b_id
            AND NOT EXISTS (SELECT 1 FROM map_relationship_copies l WHERE l.feed_relationship_id = fr.id)
            AND NOT EXISTS (
              SELECT 1 FROM social_profile_relationships spr
               WHERE spr.relationship_type::text = (CASE fr.relationship_type::text ${cases} END)
                 AND ((spr.source_profile_id = fr.influencer_a_id AND spr.target_profile_id = fr.influencer_b_id)
                   OR (spr.source_profile_id = fr.influencer_b_id AND spr.target_profile_id = fr.influencer_a_id)))`,
        { transaction });
      if (left.n) {
        throw new Error(`${left.n} feed_profile_relationships row(s) are not in social_profile_relationships; not dropping the table.`);
      }
      await queryInterface.dropTable(TABLE, { transaction });
      await sequelize.query(`DROP TYPE IF EXISTS "${TYPE}"`, { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) return;
    await sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(TABLE, {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
        influencer_a_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'social_profiles', key: 'id' }, onDelete: 'CASCADE' },
        influencer_b_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'social_profiles', key: 'id' }, onDelete: 'CASCADE' },
        relationship_type: {
          type: Sequelize.ENUM('collab', 'beef', 'copy_cat', 'mentor', 'public_shade', 'silent_alliance', 'former_friends', 'competitors', 'orbit'),
          allowNull: false,
        },
        is_public: { type: Sequelize.BOOLEAN, defaultValue: true },
        story_position: { type: Sequelize.UUID, allowNull: true, references: { model: 'story_clock_markers', key: 'id' }, onDelete: 'SET NULL' },
        notes: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });
      for (const col of ['influencer_a_id', 'influencer_b_id', 'relationship_type', 'story_position']) {
        await queryInterface.addIndex(TABLE, [col], { transaction });
      }
    });
  },
};
