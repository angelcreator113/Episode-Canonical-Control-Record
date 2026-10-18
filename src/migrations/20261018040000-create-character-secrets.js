'use strict';

/**
 * character_secrets (Evoni, 2026-10-17, stage B of the storytelling plan:
 * "Give each story a revelation budget ... Before writing, the system should
 * decide what it is allowed to reveal"; "A writer knowing something about a
 * character does not mean the character knows it, or that the audience
 * should hear it").
 *
 * One row per secret a character keeps: what it is (text), the part of the
 * inner life it comes from (source_field), who in the story knows it
 * (known_by: registry character ids), where it stands with the audience
 * (state: hidden | hinted | revealed, and where), what each layer may do
 * with it (permissions: { episode, short_story, chapter }, each
 * hidden | hint | reveal; Hint only unless Evoni chooses), and whether it
 * is kept (status: candidate | confirmed | retired). The Character Story
 * Brief (services/characterStoryBrief) reads the confirmed ones.
 *
 * Raw SQL in services/characterSecrets; no model. Guarded: created only
 * when absent. down drops it.
 */

const TABLE = 'character_secrets';

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
        registry_character_id: { type: Sequelize.UUID, allowNull: false },
        text: { type: Sequelize.TEXT, allowNull: false },
        source_field: { type: Sequelize.STRING(40), allowNull: true },
        known_by: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
        state: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'hidden' },
        state_where: { type: Sequelize.JSONB, allowNull: true },
        permissions: {
          type: Sequelize.JSONB, allowNull: false,
          defaultValue: Sequelize.literal(`'{"episode":"hint","short_story":"hint","chapter":"hint"}'::jsonb`),
        },
        status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'confirmed' },
        created_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_character ON ${TABLE} (registry_character_id, status) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
