'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('script_metadata', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      script_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'episode_scripts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      scene_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Scene identifier from script (e.g., INTRO, MAIN-1)',
      },
      scene_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'intro | main | transition | outro',
      },
      duration_target_seconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'AI-suggested duration',
      },
      energy_level: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'high | medium | low',
      },
      estimated_clips_needed: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'How many clips AI estimates are needed',
      },
      visual_requirements: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Suggested visuals (wardrobe, B-roll, etc.)',
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

    // Add indexes
    await queryInterface.addIndex('script_metadata', ['script_id'], {
      name: 'idx_script_metadata_script_id',
    });

    await queryInterface.addIndex('script_metadata', ['scene_type'], {
      name: 'idx_script_metadata_scene_type',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('script_metadata');
  },
};
