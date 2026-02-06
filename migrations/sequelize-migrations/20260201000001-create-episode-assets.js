'use strict';

/**
 * Migration: Create episode_assets table
 * Join table for episode-level asset library (Library → Episode layer)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('episode_assets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
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
        comment: 'Episode this asset is available in',
      },
      asset_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'assets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Show-level asset reference',
      },
      folder: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Organization folder (Promo, Overlays, Lower Thirds, etc.)',
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Display order within episode library',
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Episode-specific tags for filtering',
      },
      added_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      added_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'User who added this asset to episode',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Indexes for performance
    await queryInterface.addIndex('episode_assets', ['episode_id'], {
      name: 'idx_episode_assets_episode_id',
    });

    await queryInterface.addIndex('episode_assets', ['asset_id'], {
      name: 'idx_episode_assets_asset_id',
    });

    await queryInterface.addIndex('episode_assets', ['episode_id', 'folder'], {
      name: 'idx_episode_assets_episode_folder',
    });

    // Unique constraint: same asset can't be added twice to same episode
    await queryInterface.addIndex('episode_assets', ['episode_id', 'asset_id'], {
      unique: true,
      name: 'unique_episode_asset',
    });

    console.log('✓ Created episode_assets table');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('episode_assets');
    console.log('✓ Dropped episode_assets table');
  },
};
