'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // user_decisions table
    await queryInterface.createTable('user_decisions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      episode_id: {
        type: Sequelize.UUID,
        references: {
          model: 'episodes',
          key: 'id'
        },
        onDelete: 'CASCADE',
      },
      scene_id: {
        type: Sequelize.UUID,
        references: {
          model: 'scenes',
          key: 'id'
        },
        onDelete: 'SET NULL',
      },
      decision_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      decision_category: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      chosen_option: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      rejected_options: {
        type: Sequelize.JSONB,
      },
      was_ai_suggestion: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      ai_confidence_score: {
        type: Sequelize.DECIMAL(3,2),
      },
      user_rating: {
        type: Sequelize.INTEGER,
      },
      user_notes: {
        type: Sequelize.TEXT,
      },
      context_data: {
        type: Sequelize.JSONB,
      },
      timestamp: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      created_by: {
        type: Sequelize.STRING(255),
      },
    });

    // Indexes for user_decisions
    await queryInterface.addIndex('user_decisions', ['episode_id']);
    await queryInterface.addIndex('user_decisions', ['scene_id']);
    await queryInterface.addIndex('user_decisions', ['decision_type']);
    await queryInterface.addIndex('user_decisions', ['decision_category']);
    await queryInterface.addIndex('user_decisions', ['timestamp']);
    await queryInterface.addIndex('user_decisions', ['was_ai_suggestion']);
    
    // GIN indexes for JSONB
    await queryInterface.sequelize.query(
      'CREATE INDEX user_decisions_chosen_option_gin ON user_decisions USING gin(chosen_option);'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX user_decisions_context_data_gin ON user_decisions USING gin(context_data);'
    );

    // decision_patterns table
    await queryInterface.createTable('decision_patterns', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      pattern_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      pattern_category: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      pattern_data: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      sample_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      confidence_score: {
        type: Sequelize.DECIMAL(3,2),
        allowNull: false,
      },
      last_updated: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      first_detected: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Indexes for decision_patterns
    await queryInterface.addIndex('decision_patterns', ['pattern_type']);
    await queryInterface.addIndex('decision_patterns', ['pattern_category']);
    await queryInterface.addIndex('decision_patterns', ['confidence_score']);
    await queryInterface.addIndex('decision_patterns', ['sample_count']);

    // Add check constraint for user_rating
    await queryInterface.sequelize.query(
      'ALTER TABLE user_decisions ADD CONSTRAINT user_rating_check CHECK (user_rating BETWEEN 1 AND 5);'
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('decision_patterns');
    await queryInterface.dropTable('user_decisions');
  }
};
