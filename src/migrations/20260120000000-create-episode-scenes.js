'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
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
        onDelete: 'RESTRICT',
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
    });

    // Add indexes for performance
    await queryInterface.addIndex('episode_scenes', ['episode_id']);
    await queryInterface.addIndex('episode_scenes', ['scene_library_id']);
    await queryInterface.addIndex('episode_scenes', ['episode_id', 'scene_order']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('episode_scenes');
  },
};
