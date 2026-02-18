/**
 * Migration: World Events Library
 * 
 * Creates world_events table for the reusable event catalog.
 * Events can be injected into episodes and feed the evaluation system.
 * 
 * Location: src/migrations/20260219000003-world-events.js
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('world_events', {
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
      arc_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      // Identity
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      event_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'invite',
        comment: 'invite | upgrade | guest | fail_test | deliverable | brand_deal',
      },
      host_brand: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Maison Belle, Luxe Cosmetics, etc.',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Scoring attributes
      prestige: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
        comment: '1-10',
      },
      cost_coins: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      strictness: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
        comment: '1-10',
      },
      deadline_type: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: 'medium',
        comment: 'none | low | medium | high | tonight | urgent',
      },
      deadline_minutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      dress_code: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      dress_code_keywords: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: '["romantic","vintage","lace","couture"]',
      },

      // Narrative
      location_hint: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Parisian rooftop garden, golden hour, marble tables',
      },
      narrative_stakes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What this event means for Lala\'s arc',
      },
      canon_consequences: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: '{"slay":{"unlock":"luxury_brand_attention"},"fail":{"consequence":"brand_reconsiders"}}',
      },
      seeds_future_events: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Event IDs or names this unlocks on success',
      },

      // Production helpers
      overlay_template: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'luxury_invite',
        comment: 'Invite letter overlay style',
      },
      required_ui_overlays: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: ['MailPanel', 'InviteLetterOverlay', 'ToDoList'],
      },
      browse_pool_bias: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: 'balanced',
      },
      browse_pool_size: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 8,
      },

      // Rewards
      rewards: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: '{"slay":{"coins":50,"reputation":3},"pass":{"coins":0,"reputation":1},"fail":{"reputation":-2}}',
      },

      // Status
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'draft',
        comment: 'draft | ready | used | archived',
      },
      used_in_episode_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      times_used: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
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

    await queryInterface.addIndex('world_events', ['show_id'], { name: 'idx_world_events_show' });
    await queryInterface.addIndex('world_events', ['event_type'], { name: 'idx_world_events_type' });
    await queryInterface.addIndex('world_events', ['status'], { name: 'idx_world_events_status' });
    await queryInterface.addIndex('world_events', ['prestige'], { name: 'idx_world_events_prestige' });

    console.log('✅ World events table created');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('world_events').catch(() => {});
    console.log('✅ World events table dropped');
  },
};
