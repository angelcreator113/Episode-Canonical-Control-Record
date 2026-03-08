'use strict';

/** Migration: 20260307400000-novel-intelligence-engine
 *
 * Creates four tables:
 *   voice_signals      — edit patterns detected → proposed voice rules
 *   voice_rules        — confirmed voice rules per series
 *   manuscript_metadata — book description, TOC, chapter/section titles
 *   brain_fingerprints  — content hashes for deduplication
 */

module.exports = {
  async up(queryInterface, Sequelize) {

    // ── 1. voice_signals ─────────────────────────────────────────────────────
    await queryInterface.createTable('voice_signals', {
      id:            { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      series_id:     { type: Sequelize.INTEGER, allowNull: true },
      book_id:       { type: Sequelize.INTEGER, allowNull: true },
      chapter_id:    { type: Sequelize.INTEGER, allowNull: true },
      line_id:       { type: Sequelize.INTEGER, allowNull: true },
      original_text: { type: Sequelize.TEXT, allowNull: false },
      edited_text:   { type: Sequelize.TEXT, allowNull: false },
      diff_summary:  { type: Sequelize.TEXT, allowNull: true },
      scene_context: { type: Sequelize.STRING(100), allowNull: true },
      pattern_tag:   { type: Sequelize.STRING(100), allowNull: true },
      pattern_confidence: { type: Sequelize.FLOAT, defaultValue: 0 },
      proposed_rule_id: { type: Sequelize.INTEGER, allowNull: true },
      status: {
        type: Sequelize.ENUM('raw', 'analyzed', 'grouped', 'promoted', 'dismissed'),
        defaultValue: 'raw',
      },
      created_at:    { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at:    { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      deleted_at:    { type: Sequelize.DATE, allowNull: true },
    });

    // ── 2. voice_rules ───────────────────────────────────────────────────────
    await queryInterface.createTable('voice_rules', {
      id:              { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      series_id:       { type: Sequelize.INTEGER, allowNull: true },
      character_name:  { type: Sequelize.STRING(100), allowNull: true },
      rule_text:       { type: Sequelize.TEXT, allowNull: false },
      rule_type: {
        type: Sequelize.ENUM(
          'opening_phrase', 'closing_phrase', 'address_pattern',
          'scene_opening', 'scene_closing', 'dialogue_pattern',
          'interior_monologue', 'tonal_constraint', 'structural_pattern'
        ),
        defaultValue: 'dialogue_pattern',
      },
      example_original: { type: Sequelize.TEXT, allowNull: true },
      example_edited:   { type: Sequelize.TEXT, allowNull: true },
      signal_count:     { type: Sequelize.INTEGER, defaultValue: 1 },
      confirmed_by_author: { type: Sequelize.BOOLEAN, defaultValue: false },
      confirmed_at:    { type: Sequelize.DATE, allowNull: true },
      injection_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      last_injected_at: { type: Sequelize.DATE, allowNull: true },
      status: {
        type: Sequelize.ENUM('proposed', 'active', 'paused', 'superseded'),
        defaultValue: 'proposed',
      },
      created_at:      { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at:      { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      deleted_at:      { type: Sequelize.DATE, allowNull: true },
    });

    // ── 3. manuscript_metadata ───────────────────────────────────────────────
    await queryInterface.createTable('manuscript_metadata', {
      id:              { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      series_id:       { type: Sequelize.INTEGER, allowNull: true },
      book_id:         { type: Sequelize.INTEGER, allowNull: false },
      stories_included: { type: Sequelize.INTEGER, defaultValue: 0 },
      book_title:      { type: Sequelize.STRING(300), allowNull: true },
      tagline:         { type: Sequelize.TEXT, allowNull: true },
      amazon_description: { type: Sequelize.TEXT, allowNull: true },
      one_line_logline:   { type: Sequelize.TEXT, allowNull: true },
      section_establishment: { type: Sequelize.STRING(300), allowNull: true },
      section_pressure:      { type: Sequelize.STRING(300), allowNull: true },
      section_crisis:        { type: Sequelize.STRING(300), allowNull: true },
      section_integration:   { type: Sequelize.STRING(300), allowNull: true },
      table_of_contents: { type: Sequelize.JSONB, defaultValue: [] },
      dominant_themes:   { type: Sequelize.JSONB, defaultValue: [] },
      recurring_motifs:  { type: Sequelize.JSONB, defaultValue: [] },
      pain_point_summary: { type: Sequelize.JSONB, defaultValue: [] },
      lala_seed_count:   { type: Sequelize.INTEGER, defaultValue: 0 },
      lala_seed_moments: { type: Sequelize.JSONB, defaultValue: [] },
      generated_at:     { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      generation_model: { type: Sequelize.STRING(60), allowNull: true },
      author_approved:  { type: Sequelize.BOOLEAN, defaultValue: false },
      approved_at:      { type: Sequelize.DATE, allowNull: true },
      author_overrides: { type: Sequelize.JSONB, defaultValue: {} },
      created_at:       { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at:       { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      deleted_at:       { type: Sequelize.DATE, allowNull: true },
    });

    // ── 4. brain_fingerprints ────────────────────────────────────────────────
    await queryInterface.createTable('brain_fingerprints', {
      id:              { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      brain_type: {
        type: Sequelize.ENUM('story', 'tech', 'show', 'voice'),
        allowNull: false,
      },
      series_id:       { type: Sequelize.INTEGER, allowNull: true },
      entry_id:        { type: Sequelize.INTEGER, allowNull: false },
      content_hash:    { type: Sequelize.STRING(64), allowNull: false },
      title_hash:      { type: Sequelize.STRING(64), allowNull: true },
      source_document: { type: Sequelize.STRING(200), allowNull: true },
      source_version:  { type: Sequelize.STRING(20), allowNull: true },
      status: {
        type: Sequelize.ENUM('active', 'superseded', 'duplicate_blocked'),
        defaultValue: 'active',
      },
      superseded_by:   { type: Sequelize.INTEGER, allowNull: true },
      created_at:      { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at:      { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      deleted_at:      { type: Sequelize.DATE, allowNull: true },
    });

    // Indexes
    await queryInterface.addIndex('brain_fingerprints', ['brain_type', 'content_hash'], {
      unique: false,
      name: 'idx_brain_fingerprints_hash',
    });

    await queryInterface.addIndex('brain_fingerprints', ['brain_type', 'series_id', 'source_document', 'source_version'], {
      name: 'idx_brain_fingerprints_source',
    });

    await queryInterface.addIndex('voice_signals', ['series_id', 'pattern_tag', 'status'], {
      name: 'idx_voice_signals_pattern',
    });

    await queryInterface.addIndex('voice_rules', ['series_id', 'character_name', 'status'], {
      name: 'idx_voice_rules_series',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('brain_fingerprints');
    await queryInterface.dropTable('manuscript_metadata');
    await queryInterface.dropTable('voice_rules');
    await queryInterface.dropTable('voice_signals');
  },
};
