'use strict';

/**
 * Named families (Evoni, 2026-10-23: "I want them all"): "the Monroes", who
 * is in them and in which generation.
 *
 *   families        id, show_id (nullable), name, home_city, notes
 *   family_members  one person in a family, who is one of:
 *                     registry_character_id  a character
 *                     social_profile_id      a Pulse profile with no character
 *                     ghost_name             a name only, not built yet
 *                   role                   their role in the family ("aunt")
 *                   role_of_character_id   whose <role> they are (Dre's aunt);
 *                                          NULL reads as the family's
 *                   generation             smaller is older (the person the
 *                                          family was started from is 0, their
 *                                          mother -1, their son 1); the tree
 *                                          puts the smallest at the top; NULL
 *                                          when unknown
 *
 * Raw SQL in routes/families.js and services/familyTies; no model (as
 * season_twists). Both tables keep deleted_at. Guarded: created only when
 * absent. down drops both.
 */

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'families', transaction))) {
        await queryInterface.createTable('families', {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          show_id: { type: Sequelize.UUID, allowNull: true },
          name: { type: Sequelize.STRING(200), allowNull: false },
          home_city: { type: Sequelize.STRING(120), allowNull: true },
          notes: { type: Sequelize.TEXT, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
        await sequelize.query('CREATE INDEX IF NOT EXISTS families_show ON families (show_id) WHERE deleted_at IS NULL', { transaction });
      }
      if (!(await tableExists(sequelize, 'family_members', transaction))) {
        await queryInterface.createTable('family_members', {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          family_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'families', key: 'id' }, onDelete: 'CASCADE' },
          registry_character_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'registry_characters', key: 'id' }, onDelete: 'SET NULL' },
          social_profile_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'social_profiles', key: 'id' }, onDelete: 'SET NULL' },
          ghost_name: { type: Sequelize.STRING(200), allowNull: true },
          role: { type: Sequelize.STRING(120), allowNull: true },
          role_of_character_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'registry_characters', key: 'id' }, onDelete: 'SET NULL' },
          generation: { type: Sequelize.INTEGER, allowNull: true },
          notes: { type: Sequelize.TEXT, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
        // A member is someone: a character, a Pulse profile or a name.
        await sequelize.query(
          `ALTER TABLE family_members ADD CONSTRAINT family_members_someone_check
             CHECK (registry_character_id IS NOT NULL OR social_profile_id IS NOT NULL OR NULLIF(TRIM(ghost_name), '') IS NOT NULL)`,
          { transaction });
        await sequelize.query('CREATE INDEX IF NOT EXISTS family_members_family ON family_members (family_id) WHERE deleted_at IS NULL', { transaction });
        await sequelize.query('CREATE INDEX IF NOT EXISTS family_members_character ON family_members (registry_character_id) WHERE deleted_at IS NULL', { transaction });
        await sequelize.query('CREATE INDEX IF NOT EXISTS family_members_profile ON family_members (social_profile_id) WHERE deleted_at IS NULL', { transaction });
        // One live row per character, and per profile, in a family.
        await sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS family_members_one_character ON family_members (family_id, registry_character_id)
             WHERE deleted_at IS NULL AND registry_character_id IS NOT NULL`, { transaction });
        await sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS family_members_one_profile ON family_members (family_id, social_profile_id)
             WHERE deleted_at IS NULL AND social_profile_id IS NOT NULL`, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query('DROP TABLE IF EXISTS family_members', { transaction });
      await sequelize.query('DROP TABLE IF EXISTS families', { transaction });
    });
  },
};
