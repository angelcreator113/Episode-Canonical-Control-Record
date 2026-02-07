'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('thumbnail_compositions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'episodes',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'episode_templates',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      background_frame_asset_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      lala_asset_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      guest_asset_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      justawomen_asset_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      justawomaninherprime_asset_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      selected_formats: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'draft',
      },
      created_by: {
        type: Sequelize.STRING(255),
        allowNull: true,
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
      current_version: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      version_history: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      last_modified_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      modification_timestamp: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        comment: 'Whether this is the primary/canonical composition for the episode',
      },
      composition_config: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Stores visibility toggles, text field values, and per-composition overrides',
      },
    });

    // Add indexes
    await queryInterface.addIndex('thumbnail_compositions', ['episode_id']);
    await queryInterface.addIndex('thumbnail_compositions', ['template_id']);
    await queryInterface.addIndex('thumbnail_compositions', ['episode_id', 'is_primary']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('thumbnail_compositions');
  },
};
