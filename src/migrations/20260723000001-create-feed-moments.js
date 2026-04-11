'use strict';

/**
 * Create feed_moments table — persists phone-screen moments from episodes.
 * Previously these were generated on the fly but never saved.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('feed_moments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      show_id: { type: Sequelize.UUID, allowNull: false },
      episode_id: { type: Sequelize.UUID, allowNull: false },
      event_id: { type: Sequelize.UUID, allowNull: true },

      beat_number: { type: Sequelize.INTEGER, allowNull: false },
      beat_context: { type: Sequelize.TEXT, allowNull: true },

      trigger_profile_id: { type: Sequelize.INTEGER, allowNull: true },
      trigger_handle: { type: Sequelize.STRING(100), allowNull: true },
      trigger_action: { type: Sequelize.STRING(100), allowNull: true },

      phone_screen_type: { type: Sequelize.STRING(30), allowNull: true },
      screen_content: { type: Sequelize.TEXT, allowNull: true },
      screen_image_desc: { type: Sequelize.TEXT, allowNull: true },
      asset_type: { type: Sequelize.STRING(50), allowNull: true },
      asset_role: { type: Sequelize.STRING(80), allowNull: true },

      justawoman_line: { type: Sequelize.TEXT, allowNull: true },
      justawoman_action: { type: Sequelize.STRING(200), allowNull: true },
      lala_line: { type: Sequelize.TEXT, allowNull: true },
      lala_internal: { type: Sequelize.TEXT, allowNull: true },
      direction: { type: Sequelize.TEXT, allowNull: true },

      financial_context: { type: Sequelize.JSONB, allowNull: true },

      emotional_shift: { type: Sequelize.STRING(50), allowNull: true },
      behavior_change: { type: Sequelize.TEXT, allowNull: true },
      feeds_into_beat: { type: Sequelize.INTEGER, allowNull: true },

      sort_order: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('feed_moments', ['episode_id']);
    await queryInterface.addIndex('feed_moments', ['event_id'], { where: { event_id: { [Sequelize.Op.ne]: null } } });
    await queryInterface.addIndex('feed_moments', ['episode_id', 'beat_number']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('feed_moments');
  },
};
