'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ui_overlay_types', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'shows', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Show this overlay type belongs to',
      },
      type_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Unique key within show (e.g., phone_icon, custom_frame_1)',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'icon',
        comment: 'frame or icon',
      },
      beat: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Episode beat reference (e.g., Beat 3, Various)',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      prompt: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Image generation prompt',
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 100,
        comment: 'Display order (lower = first)',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Soft delete timestamp',
      },
    });

    await queryInterface.addIndex('ui_overlay_types', ['show_id']);
    await queryInterface.addIndex('ui_overlay_types', ['show_id', 'type_key'], {
      unique: true,
      where: { deleted_at: null },
      name: 'ui_overlay_types_show_type_key_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ui_overlay_types');
  },
};
