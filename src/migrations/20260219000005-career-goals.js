/**
 * Migration: Career Goals
 * 
 * Creates career_goals table for the multi-goal tension system.
 * 1 Primary + 2 Secondary + Passive background goals.
 * 
 * Location: src/migrations/20260219000005-career-goals.js
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('career_goals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      season_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      // Identity
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'secondary',
        comment: 'primary | secondary | passive',
      },

      // Tracking
      target_metric: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'coins, reputation, followers, brand_trust, influence, engagement_rate, portfolio_strength, consistency_streak, custom',
      },
      target_value: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      current_value: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      starting_value: {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: 'Value when goal was created — for progress calculation',
      },

      // Status
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        comment: 'active | completed | failed | paused | abandoned',
      },
      priority: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
        comment: '1=highest, 5=lowest',
      },

      // Unlocks
      unlocks_on_complete: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: '["maison_belle_contract","luxury_closet_upgrade"]',
      },
      fail_consequence: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Arc alignment
      arc_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      episode_range: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: '{"start":1,"end":6}',
      },

      // Metadata
      icon: {
        type: Sequelize.STRING(10),
        allowNull: true,
        defaultValue: '🎯',
      },
      color: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: '#6366f1',
      },

      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('career_goals', ['show_id'], { name: 'idx_career_goals_show' });
    await queryInterface.addIndex('career_goals', ['type'], { name: 'idx_career_goals_type' });
    await queryInterface.addIndex('career_goals', ['status'], { name: 'idx_career_goals_status' });
    await queryInterface.addIndex('career_goals', ['show_id', 'type', 'status'], { name: 'idx_career_goals_active' });

    console.log('✅ Career goals table created');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('career_goals').catch(() => {});
  },
};
