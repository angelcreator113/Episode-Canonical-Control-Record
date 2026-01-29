'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('episode_scenes', {
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
        comment: 'Episode this scene is assigned to',
      },
      scene_library_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'scene_library',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT', // Prevent deleting library scenes that are in use
        comment: 'Reference to the scene in the library',
      },
      scene_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order/sequence of scene in episode',
      },
      trim_start: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
        comment: 'Episode-specific trim start time in seconds',
      },
      trim_end: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
        comment: 'Episode-specific trim end time in seconds',
      },
      scene_type: {
        type: Sequelize.ENUM('intro', 'main', 'transition', 'outro'),
        allowNull: true,
        defaultValue: 'main',
        comment: 'Episode-specific scene type/context',
      },
      episode_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Episode-specific notes for this scene',
      },
      production_status: {
        type: Sequelize.ENUM('draft', 'storyboarded', 'recorded', 'edited', 'complete'),
        allowNull: false,
        defaultValue: 'draft',
        comment: 'Production status of this scene in the episode',
      },
      created_by: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'User who added this scene to the episode',
      },
      updated_by: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'User who last updated this episode scene',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Soft delete timestamp',
      },
    });

    // Add indexes for common queries
    await queryInterface.addIndex('episode_scenes', ['episode_id'], {
      name: 'idx_episode_scenes_episode_id',
    });

    await queryInterface.addIndex('episode_scenes', ['scene_library_id'], {
      name: 'idx_episode_scenes_library_id',
    });

    await queryInterface.addIndex('episode_scenes', ['episode_id', 'scene_order'], {
      name: 'idx_episode_scenes_episode_order',
    });

    await queryInterface.addIndex('episode_scenes', ['production_status'], {
      name: 'idx_episode_scenes_status',
    });

    // Unique constraint: one library scene can be used multiple times in same episode (at different positions)
    // but we want to track each instance separately
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('episode_scenes');
  }
};
