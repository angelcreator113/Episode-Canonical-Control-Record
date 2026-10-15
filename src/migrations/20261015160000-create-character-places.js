'use strict';

/**
 * character_places: a character's own places, as scene sets (Evoni,
 * 2026-10-15: "upload the everyday scene set to the character" means
 * linking a venue to a character as their home; "Lead character is Lala
 * but other characters have home sets";
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md step 3).
 *
 * One live row per (registry_character_id, scene_set_id), a partial unique
 * index. role: home, closet or other (with an optional label, e.g. "Studio").
 * A character has at most one home and one closet (the service replaces).
 * The show's lead (shows.metadata.lead_character_id) keeps her home and
 * closet in the show's scene defaults (L3), not here.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'character_places';

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
        scene_set_id: { type: Sequelize.UUID, allowNull: false },
        role: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'home' },
        label: { type: Sequelize.STRING(80), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS character_places_unique
           ON character_places (registry_character_id, scene_set_id) WHERE deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS character_places_set ON character_places (scene_set_id) WHERE deleted_at IS NULL',
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
