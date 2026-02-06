'use strict';

/**
 * Migration: Create timeline_placements table
 * Unified placement system for assets, wardrobe, and audio on timeline
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('timeline_placements', {
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
        comment: 'Episode this placement belongs to',
      },
      
      // Placement type and references
      placement_type: {
        type: Sequelize.ENUM('asset', 'wardrobe', 'audio'),
        allowNull: false,
        comment: 'Type of item being placed',
      },
      asset_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'assets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Asset reference (for asset placements)',
      },
      wardrobe_item_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'wardrobe',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Wardrobe reference (for wardrobe placements)',
      },
      
      // Scene-attached placement (default)
      scene_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'episode_scenes',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Scene this placement is attached to (null for time-based)',
      },
      attachment_point: {
        type: Sequelize.ENUM('scene-start', 'scene-end', 'scene-middle', 'custom'),
        allowNull: true,
        defaultValue: 'scene-start',
        comment: 'Where in the scene this attaches',
      },
      offset_seconds: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: 0,
        comment: 'Offset from attachment point (seconds)',
      },
      
      // Time-based placement (for audio/global overlays)
      absolute_timestamp: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
        comment: 'Absolute time in episode (for time-based placements)',
      },
      
      // Display properties
      track_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2,
        comment: 'Timeline track (1=scenes, 2=assets, 3=audio)',
      },
      duration: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
        comment: 'Display duration (seconds, null for wardrobe events)',
      },
      z_index: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 10,
        comment: 'Layering order within track',
      },
      
      // Metadata
      properties: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Custom properties (opacity, position, effects, etc.)',
      },
      character: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Character name (for wardrobe placements)',
      },
      label: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'User-friendly label for this placement',
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
    await queryInterface.addIndex('timeline_placements', ['episode_id'], {
      name: 'idx_timeline_placements_episode_id',
    });

    await queryInterface.addIndex('timeline_placements', ['scene_id'], {
      name: 'idx_timeline_placements_scene_id',
    });

    await queryInterface.addIndex('timeline_placements', ['episode_id', 'placement_type'], {
      name: 'idx_timeline_placements_episode_type',
    });

    await queryInterface.addIndex('timeline_placements', ['episode_id', 'track_number'], {
      name: 'idx_timeline_placements_episode_track',
    });

    // Composite index for wardrobe carry-forward lookups
    await queryInterface.addIndex('timeline_placements', 
      ['episode_id', 'placement_type', 'character', 'scene_id'], 
      {
        name: 'idx_timeline_placements_wardrobe_lookup',
        where: {
          placement_type: 'wardrobe'
        }
      }
    );

    console.log('✓ Created timeline_placements table');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('timeline_placements');
    console.log('✓ Dropped timeline_placements table');
  },
};
