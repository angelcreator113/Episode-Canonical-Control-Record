'use strict';

/**
 * The Relationship Map edits the relationships The Pulse reads (Task #3115;
 * Evoni, 2026-10-13: "go with (a)", docs/reads/2026-10-13-pulse-relationships-read.md §5).
 *
 *   1. social_profile_relationships.relationship_type gains 'orbit' and
 *      'former_friends', the map's two kinds The Pulse had not (Evoni: add
 *      both as Pulse kinds). Enum values are added outside a transaction.
 *   2. Every feed_profile_relationships row is copied into
 *      social_profile_relationships with its kind (seven map 1:1, the two
 *      above as themselves), unless the pair already has that kind there
 *      either way round. Each copy is logged in map_relationship_copies;
 *      down deletes exactly those.
 *
 * feed_profile_relationships is left as it is: nothing is deleted.
 */

const FEED_TO_PULSE = Object.freeze({
  collab: 'collab', beef: 'feud', copy_cat: 'copycat', mentor: 'mentor', public_shade: 'shade',
  silent_alliance: 'secret_link', competitors: 'rival', orbit: 'orbit', former_friends: 'former_friends',
});
const TYPE = 'enum_social_profile_relationships_relationship_type';
const LOG = 'map_relationship_copies';
const OLD_KINDS = ['collab', 'rival', 'couple', 'ex', 'baby_daddy', 'baby_mama', 'bestie', 'mentor', 'copycat',
  'shade', 'situationship', 'family', 'management', 'feud', 'secret_link'];

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;
const tableExists = (sequelize, name) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name });

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (await exists(sequelize, 'SELECT 1 FROM pg_type WHERE typname = :name', { name: TYPE })) {
      await sequelize.query(`ALTER TYPE "${TYPE}" ADD VALUE IF NOT EXISTS 'orbit'`);
      await sequelize.query(`ALTER TYPE "${TYPE}" ADD VALUE IF NOT EXISTS 'former_friends'`);
    }
    if (!(await tableExists(sequelize, 'feed_profile_relationships'))) return;

    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, LOG))) {
        await queryInterface.createTable(LOG, {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          feed_relationship_id: { type: Sequelize.UUID, allowNull: false },
          social_relationship_id: { type: Sequelize.INTEGER, allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      const [rows] = await sequelize.query(
        `SELECT fr.id, fr.influencer_a_id AS a, fr.influencer_b_id AS b, fr.relationship_type::text AS type, fr.is_public, fr.notes
           FROM feed_profile_relationships fr
           JOIN social_profiles pa ON pa.id = fr.influencer_a_id
           JOIN social_profiles pb ON pb.id = fr.influencer_b_id
          WHERE fr.influencer_a_id <> fr.influencer_b_id
            AND NOT EXISTS (SELECT 1 FROM ${LOG} l WHERE l.feed_relationship_id = fr.id)
          ORDER BY fr.created_at NULLS FIRST, fr.id`, { transaction });
      for (const r of rows) {
        const kind = FEED_TO_PULSE[r.type];
        if (!kind) continue;
        const [[had]] = await sequelize.query(
          `SELECT COUNT(*)::int AS n FROM social_profile_relationships
            WHERE relationship_type::text = :kind
              AND ((source_profile_id = :a AND target_profile_id = :b) OR (source_profile_id = :b AND target_profile_id = :a))`,
          { replacements: { kind, a: r.a, b: r.b }, transaction });
        if (had.n) continue;
        const [[made]] = await sequelize.query(
          `INSERT INTO social_profile_relationships
             (source_profile_id, target_profile_id, relationship_type, direction, public_visibility, description, auto_generated, created_at, updated_at)
           VALUES (:a, :b, :kind, 'mutual', :visibility, :notes, false, NOW(), NOW()) RETURNING id`,
          { replacements: { a: r.a, b: r.b, kind, visibility: r.is_public === false ? 'hidden' : 'public', notes: r.notes || null }, transaction });
        await sequelize.query(`INSERT INTO ${LOG} (feed_relationship_id, social_relationship_id) VALUES (:fr, :sr)`,
          { replacements: { fr: r.id, sr: made.id }, transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    const hasType = await exists(sequelize, 'SELECT 1 FROM pg_type WHERE typname = :name', { name: TYPE });
    const hasLog = await tableExists(sequelize, LOG);
    // Rows given Orbit or Former friends since (on the map), other than this
    // migration's copies, are not deleted: down stops before changing anything.
    if (hasType) {
      const [[left]] = await sequelize.query(
        `SELECT COUNT(*)::int AS n FROM social_profile_relationships
          WHERE relationship_type::text IN ('orbit', 'former_friends')
            ${hasLog ? `AND id NOT IN (SELECT social_relationship_id FROM ${LOG})` : ''}`);
      if (left.n) {
        throw new Error(`${left.n} relationship(s) have the Orbit or Former friends kind; change or delete them before undoing this migration.`);
      }
    }
    if (hasLog) {
      await sequelize.transaction(async (transaction) => {
        await sequelize.query(`DELETE FROM social_profile_relationships WHERE id IN (SELECT social_relationship_id FROM ${LOG})`, { transaction });
        await queryInterface.dropTable(LOG, { transaction });
      });
    }
    if (!hasType) return;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`ALTER TYPE "${TYPE}" RENAME TO "${TYPE}_old"`, { transaction });
      await sequelize.query(`CREATE TYPE "${TYPE}" AS ENUM (${OLD_KINDS.map((k) => `'${k}'`).join(', ')})`, { transaction });
      await sequelize.query(
        `ALTER TABLE social_profile_relationships ALTER COLUMN relationship_type TYPE "${TYPE}" USING relationship_type::text::"${TYPE}"`, { transaction });
      await sequelize.query(`DROP TYPE "${TYPE}_old"`, { transaction });
    });
  },
};
