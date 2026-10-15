'use strict';

/**
 * Script version history (Script tab audit, 2026-10-15: "there's no undo,
 * and Regenerate replaces the whole script").
 *
 *   episode_script_versions  one row per script the Script tab replaced:
 *                            the episode, the script text and its locked
 *                            beats as they were, what replaced it (save,
 *                            lock, generate) and who. The newest 50 per
 *                            episode are kept (services/scriptVersions.js).
 *
 * Reading a version never changes the episode: the Script tab shows it,
 * and a restore is an ordinary save. Guarded and reversible.
 */

const TABLE = 'episode_script_versions';

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS t', { replacements: { name: TABLE }, transaction });
  return Boolean(rows[0]?.t);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, transaction)) return;
      await queryInterface.createTable(TABLE, {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
        episode_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'episodes', key: 'id' }, onDelete: 'CASCADE' },
        script_content: { type: Sequelize.TEXT, allowNull: false },
        script_locked_beats: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
        source: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'save' },
        created_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await queryInterface.addIndex(TABLE, ['episode_id', 'created_at'], { name: 'episode_script_versions_episode_time', transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, transaction)) await queryInterface.dropTable(TABLE, { transaction });
    });
  },
};
