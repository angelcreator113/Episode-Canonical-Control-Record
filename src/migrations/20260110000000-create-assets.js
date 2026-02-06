'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('assets', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      asset_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Legacy type field - kept for backward compatibility',
      },
      asset_role: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Canonical role - hierarchical (e.g., CHAR.HOST.LALA, UI.ICON.CLOSET)',
      },
      asset_group: {
        type: Sequelize.ENUM('LALA', 'SHOW', 'GUEST', 'EPISODE', 'WARDROBE'),
        allowNull: true,
        comment: 'Identity bucket - which brand/entity this asset belongs to',
      },
      asset_scope: {
        type: Sequelize.ENUM('GLOBAL', 'SHOW', 'EPISODE'),
        allowNull: true,
        defaultValue: 'GLOBAL',
        comment: 'Scope of asset availability - GLOBAL, SHOW, or EPISODE',
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'shows',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Show ID if asset_scope is SHOW',
      },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'episodes',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Episode ID if asset_scope is EPISODE',
      },
      purpose: {
        type: Sequelize.ENUM('MAIN', 'TITLE', 'ICON', 'BACKGROUND'),
        allowNull: true,
        comment: 'Category - what kind of asset this is',
      },
      allowed_uses: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: true,
        defaultValue: [],
        comment: 'What this asset CAN be used for',
      },
      is_global: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Available globally vs scoped to show/episode',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      s3_url_raw: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      s3_url_processed: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      s3_key_raw: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      file_name: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      content_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      media_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      width: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      height: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      file_size_bytes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
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

    // Add indexes for performance
    await queryInterface.addIndex('assets', ['asset_type']);
    await queryInterface.addIndex('assets', ['asset_group']);
    await queryInterface.addIndex('assets', ['asset_scope']);
    await queryInterface.addIndex('assets', ['show_id']);
    await queryInterface.addIndex('assets', ['episode_id']);
    await queryInterface.addIndex('assets', ['deleted_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('assets');
  },
};
