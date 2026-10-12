'use strict';

/**
 * pulse_voices: each posting character's Voice Profile (Task #2967; The Pulse
 * spec §7 "Voice Profiles … built from concrete habits … plus a shared list
 * of banned AI-sounding phrases. Evoni's edits and pinned posts become voice
 * examples"; docs/reads/2026-10-12-pulse-posting-read.md §2). Evoni,
 * 2026-10-12: a table of its own, not a column on registry_characters
 * (F-Reg-2) or social_profiles.
 *
 *   registry_character_id   one voice per character
 *   habits_json             case, punctuation, emoji, sentence length,
 *                           topics, phrases they would never use
 *   examples_json           Evoni's edits and pinned posts
 *   source_hash             what the voice was built from, so a changed
 *                           profile shows the voice needs a rebuild
 *   status                  built | edited
 *
 * New table only, with deleted_at. Guarded: created only when absent. down
 * drops it.
 */

const TABLE = 'pulse_voices';

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
        registry_character_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'registry_characters', key: 'id' }, onDelete: 'CASCADE' },
        social_profile_id: { type: Sequelize.INTEGER, allowNull: true },
        habits_json: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        examples_json: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        source_hash: { type: Sequelize.STRING(64), allowNull: true },
        status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'built' },
        built_at: { type: Sequelize.DATE, allowNull: true },
        edited_by: { type: Sequelize.STRING(255), allowNull: true },
        edited_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      // One voice per character.
      await sequelize.query(
        `CREATE UNIQUE INDEX pulse_voices_one_per_character ON ${TABLE} (registry_character_id) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) await queryInterface.dropTable(TABLE, { transaction });
    });
  },
};
