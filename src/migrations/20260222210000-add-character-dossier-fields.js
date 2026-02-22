/**
 * Migration: Add 8-section dossier fields to registry_characters
 *
 * Section 1 — Core Identity additions: canon_tier, first_appearance, era_introduced, creator
 * Section 2 — Essence Profile: core_desire, core_fear, core_wound, mask_persona,
 *             truth_persona, character_archetype, signature_trait, emotional_baseline
 * Sections 3-8 stored as JSONB: aesthetic_dna, career_status, relationships_map,
 *             story_presence, voice_signature, evolution_tracking
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const t = queryInterface.sequelize.transaction
      ? await queryInterface.sequelize.transaction()
      : null;

    const opts = t ? { transaction: t } : {};

    try {
      /* ── Section 1: Core Identity additions ── */
      await queryInterface.addColumn('registry_characters', 'canon_tier', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Core Canon / Licensed / Minor',
      }, opts);

      await queryInterface.addColumn('registry_characters', 'first_appearance', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Book / Episode of first appearance',
      }, opts);

      await queryInterface.addColumn('registry_characters', 'era_introduced', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Narrative era when introduced',
      }, opts);

      await queryInterface.addColumn('registry_characters', 'creator', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Original creator (You or Licensed Creator)',
      }, opts);

      /* ── Section 2: Essence Profile ── */
      await queryInterface.addColumn('registry_characters', 'core_desire', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What they want most',
      }, opts);

      await queryInterface.addColumn('registry_characters', 'core_fear', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What threatens them most',
      }, opts);

      await queryInterface.addColumn('registry_characters', 'core_wound', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Backstory scar',
      }, opts);

      await queryInterface.addColumn('registry_characters', 'mask_persona', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'How they appear publicly',
      }, opts);

      await queryInterface.addColumn('registry_characters', 'truth_persona', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Who they actually are',
      }, opts);

      await queryInterface.addColumn('registry_characters', 'character_archetype', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Strategist, Dreamer, Performer, etc.',
      }, opts);

      await queryInterface.addColumn('registry_characters', 'signature_trait', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'One unforgettable behavior',
      }, opts);

      await queryInterface.addColumn('registry_characters', 'emotional_baseline', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Confident, guarded, restless, etc.',
      }, opts);

      /* ── Section 3: Aesthetic DNA (JSONB) ── */
      await queryInterface.addColumn('registry_characters', 'aesthetic_dna', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: '{ era_aesthetic, color_palette, signature_silhouette, signature_accessories, glam_energy, visual_evolution_notes }',
      }, opts);

      /* ── Section 4: Career & Status (JSONB) ── */
      await queryInterface.addColumn('registry_characters', 'career_status', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: '{ profession, career_goal, reputation_level, brand_relationships, financial_status, public_recognition, ongoing_arc }',
      }, opts);

      /* ── Section 5: Relationships (JSONB) ── */
      await queryInterface.addColumn('registry_characters', 'relationships_map', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: '{ allies, rivals, mentors, love_interests, business_partners, dynamic_notes }',
      }, opts);

      /* ── Section 6: Story Presence (JSONB) ── */
      await queryInterface.addColumn('registry_characters', 'story_presence', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: '{ appears_in_books, appears_in_shows, appears_in_series, current_story_status, unresolved_threads, future_potential }',
      }, opts);

      /* ── Section 7: Voice & Dialogue Signature (JSONB) ── */
      await queryInterface.addColumn('registry_characters', 'voice_signature', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: '{ speech_pattern, vocabulary_tone, catchphrases, internal_monologue_style, emotional_reactivity }',
      }, opts);

      /* ── Section 8: Evolution Tracking (JSONB) ── */
      await queryInterface.addColumn('registry_characters', 'evolution_tracking', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: '{ version_history, era_changes, personality_shifts, reputation_milestones, visual_transformations }',
      }, opts);

      if (t) await t.commit();
    } catch (err) {
      if (t) await t.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const cols = [
      'canon_tier', 'first_appearance', 'era_introduced', 'creator',
      'core_desire', 'core_fear', 'core_wound', 'mask_persona',
      'truth_persona', 'character_archetype', 'signature_trait', 'emotional_baseline',
      'aesthetic_dna', 'career_status', 'relationships_map',
      'story_presence', 'voice_signature', 'evolution_tracking',
    ];
    for (const col of cols) {
      await queryInterface.removeColumn('registry_characters', col);
    }
  },
};
