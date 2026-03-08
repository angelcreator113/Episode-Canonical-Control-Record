'use strict';

/** Migration: 20260308500000-social-profiles
 *
 * Creates: social_profiles
 * A new entity type — parasocial creators JustAWoman encounters in her feed.
 * Distinct from PNOS (not internal forces) and world characters (not direct relationships).
 * Can cross into real world via promotion pathway (world_exists flag).
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('social_profiles', {
      id:            { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      series_id:     { type: Sequelize.INTEGER, allowNull: true },

      // ── Spark inputs (3 fields from author) ────────────────────────────────
      handle:        { type: Sequelize.STRING(100), allowNull: false },
      platform: {
        type: Sequelize.ENUM('tiktok', 'instagram', 'youtube', 'twitter', 'onlyfans', 'twitch', 'substack', 'multi'),
        allowNull: false,
      },
      vibe_sentence: { type: Sequelize.TEXT, allowNull: false },

      // ── Generated identity ─────────────────────────────────────────────────
      display_name:          { type: Sequelize.STRING(200), allowNull: true },
      follower_tier:         { type: Sequelize.ENUM('micro', 'mid', 'macro', 'mega'), allowNull: true },
      follower_count_approx: { type: Sequelize.STRING(50), allowNull: true },
      content_category:      { type: Sequelize.STRING(100), allowNull: true },
      archetype: {
        type: Sequelize.ENUM(
          'polished_curator', 'messy_transparent', 'soft_life',
          'explicitly_paid', 'overnight_rise', 'cautionary',
          'the_peer', 'the_watcher', 'chaos_creator', 'community_builder'
        ),
        allowNull: true,
      },

      // ── Persona vs signal ──────────────────────────────────────────────────
      content_persona:  { type: Sequelize.TEXT, allowNull: true },
      real_signal:      { type: Sequelize.TEXT, allowNull: true },
      posting_voice:    { type: Sequelize.TEXT, allowNull: true },
      comment_energy:   { type: Sequelize.TEXT, allowNull: true },

      // ── Adult content ──────────────────────────────────────────────────────
      adult_content_present: { type: Sequelize.BOOLEAN, defaultValue: false },
      adult_content_type:    { type: Sequelize.TEXT, allowNull: true },
      adult_content_framing: { type: Sequelize.TEXT, allowNull: true },

      // ── Parasocial function ────────────────────────────────────────────────
      parasocial_function:  { type: Sequelize.TEXT, allowNull: true },
      emotional_activation: { type: Sequelize.STRING(200), allowNull: true },
      watch_reason:         { type: Sequelize.TEXT, allowNull: true },
      what_it_costs_her:    { type: Sequelize.TEXT, allowNull: true },

      // ── Trajectory ─────────────────────────────────────────────────────────
      current_trajectory: {
        type: Sequelize.ENUM('rising', 'plateauing', 'unraveling', 'pivoting', 'silent', 'viral_moment'),
        defaultValue: 'plateauing',
      },
      trajectory_detail: { type: Sequelize.TEXT, allowNull: true },

      // ── Moment log ─────────────────────────────────────────────────────────
      moment_log:      { type: Sequelize.JSONB, defaultValue: [] },

      // ── Generated sample content ───────────────────────────────────────────
      sample_captions: { type: Sequelize.JSONB, defaultValue: [] },
      sample_comments: { type: Sequelize.JSONB, defaultValue: [] },
      pinned_post:     { type: Sequelize.TEXT, allowNull: true },

      // ── Story engine integration ───────────────────────────────────────────
      lala_relevance_score:  { type: Sequelize.INTEGER, defaultValue: 0 },
      lala_relevance_reason: { type: Sequelize.TEXT, allowNull: true },
      book_relevance:        { type: Sequelize.JSONB, defaultValue: [] },

      // ── Crossing pathway ───────────────────────────────────────────────────
      world_exists:          { type: Sequelize.BOOLEAN, defaultValue: false },
      crossing_trigger:      { type: Sequelize.TEXT, allowNull: true },
      crossing_mechanism:    { type: Sequelize.TEXT, allowNull: true },
      crossed_at:            { type: Sequelize.DATE, allowNull: true },
      registry_character_id: { type: Sequelize.INTEGER, allowNull: true },

      // ── Status ─────────────────────────────────────────────────────────────
      status: {
        type: Sequelize.ENUM('draft', 'generated', 'finalized', 'crossed', 'archived'),
        defaultValue: 'draft',
      },
      generation_model: { type: Sequelize.STRING(60), allowNull: true },
      full_profile:     { type: Sequelize.JSONB, defaultValue: {} },

      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('social_profiles', ['handle', 'platform'], { name: 'idx_social_profiles_handle' });
    await queryInterface.addIndex('social_profiles', ['archetype', 'status'],  { name: 'idx_social_profiles_archetype' });
    await queryInterface.addIndex('social_profiles', ['series_id', 'status'],  { name: 'idx_social_profiles_series' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('social_profiles');
  },
};
