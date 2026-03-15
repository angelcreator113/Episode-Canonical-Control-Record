'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('character_follow_profiles', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      character_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Matches registry_characters.character_key',
      },
      character_name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      registry_character_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'SET NULL',
      },

      // ── Core affinities (generated from character DNA by Claude) ─────
      category_affinity: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Content category weights 0-1: { fashion: 0.8, drama: 0.9, ... }',
      },
      archetype_affinity: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Creator archetype weights 0-1: { polished_curator: 0.7, chaos_creator: 0.3, ... }',
      },
      motivation_weights: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Follow motivation weights: { identity, aspiration, entertainment, information, parasocial }',
      },

      // ── Behavioral modifiers ─────────────────────────────────────────
      drama_bonus: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0.05,
        comment: 'How much drama pulls them in beyond their baseline',
      },
      adult_penalty: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: -0.10,
        comment: 'Adjustment for adult content (negative = avoids, near-zero = unfazed)',
      },
      same_platform_bonus: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Platform preference boosts: { instagram: 0.08, tiktok: 0.05, ... }',
      },
      follower_tier_affinity: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: { micro: 0.60, mid: 0.70, macro: 0.75, mega: 0.65 },
        comment: 'Preference for creator size: { micro, mid, macro, mega }',
      },
      base_follow_threshold: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0.35,
        comment: 'Minimum probability score to auto-follow (0-1)',
      },

      // ── Consumption pattern (how they scroll, not just who) ──────────
      consumption_style: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'How they consume: late_night_scroller, passive_observer, active_engager, hate_watcher, study_mode, share_with_friends',
      },
      consumption_context: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Narrative description of how/when they consume content',
      },
      has_social_presence: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this character posts/creates (vs just consumes)',
      },

      // ── Generation metadata ──────────────────────────────────────────
      generated_from_dna: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this profile was AI-generated from character DNA',
      },
      generation_reasoning: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Claude reasoning for why these affinities were chosen',
      },
      hand_tuned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the author has manually adjusted any weights',
      },

      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('character_follow_profiles', ['character_key'], { unique: true });
    await queryInterface.addIndex('character_follow_profiles', ['registry_character_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('character_follow_profiles');
  },
};
