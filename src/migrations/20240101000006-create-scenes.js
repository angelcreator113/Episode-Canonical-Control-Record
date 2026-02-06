'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('scenes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
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
      scene_number: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      duration_seconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'draft',
      },
      ai_detected: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      ai_confidence_score: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      ai_suggested_title: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      ai_suggested_description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ai_suggested_tags: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      ai_metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
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
      },
    });

    // Add indexes
    await queryInterface.addIndex('scenes', ['episode_id'], {
      name: 'idx_scenes_episode_id',
    });

    await queryInterface.addIndex('scenes', ['scene_number'], {
      name: 'idx_scenes_scene_number',
    });

    await queryInterface.addIndex('scenes', ['status'], {
      name: 'idx_scenes_status',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('scenes');
  },
};
