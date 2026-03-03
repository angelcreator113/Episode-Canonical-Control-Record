'use strict';

/**
 * Migration: LalaVerse World Characters + Intimate Scene Generator
 * Prime Studios · March 2026
 *
 * Tables:
 *   1. world_characters        — full LalaVerse world characters (not PNOS forces)
 *   2. world_character_batches — tracks ecosystem generation runs
 *   3. intimate_scenes         — generated intimate scenes with full context
 *   4. scene_continuations     — morning-after / continuation prose
 */

module.exports = {
  async up(queryInterface, Sequelize) {

    // ── 1. world_character_batches ─────────────────────────────────────────
    await queryInterface.createTable('world_character_batches', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      show_id:      { type: Sequelize.UUID, allowNull: true },
      series_label: { type: Sequelize.STRING(100), allowNull: true }, // 'lalaverse_s1' | 'lalaverse_s2'
      world_context: { type: Sequelize.JSONB, allowNull: true },     // city, industry, career_stage, era
      character_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      generation_notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // ── 2. world_characters ────────────────────────────────────────────────
    // Real people in Lala's world — not psychological forces
    await queryInterface.createTable('world_characters', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },

      batch_id: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'world_character_batches', key: 'id' },
        onDelete: 'SET NULL',
      },

      // Also links to registry_characters if promoted
      registry_character_id: { type: Sequelize.UUID, allowNull: true },

      // Identity
      name:          { type: Sequelize.STRING(255), allowNull: false },
      age_range:     { type: Sequelize.STRING(50),  allowNull: true },  // '28-32' | 'early 30s'
      occupation:    { type: Sequelize.STRING(255), allowNull: true },
      world_location: { type: Sequelize.STRING(255), allowNull: true }, // where they exist in LalaVerse

      // Character type
      // love_interest | industry_peer | mentor | antagonist | rival | collaborator | one_night_stand | recurring
      character_type: { type: Sequelize.STRING(100), allowNull: false },

      // Romantic/intimate eligibility
      intimate_eligible: { type: Sequelize.BOOLEAN, defaultValue: false },

      // Aesthetic DNA — how they look, move, present
      aesthetic:     { type: Sequelize.TEXT, allowNull: true },
      signature:     { type: Sequelize.TEXT, allowNull: true }, // the thing they do that makes them memorable

      // What they want
      surface_want:  { type: Sequelize.TEXT, allowNull: true }, // what they'd tell you
      real_want:     { type: Sequelize.TEXT, allowNull: true },  // what they'd never admit
      what_they_want_from_lala: { type: Sequelize.TEXT, allowNull: true },

      // Relationship to Lala
      how_they_meet: { type: Sequelize.TEXT, allowNull: true },
      dynamic:       { type: Sequelize.TEXT, allowNull: true }, // the texture of their connection
      tension_type:  { type: Sequelize.STRING(100), allowNull: true }, // romantic | professional | creative | power | unspoken

      // Intimate profile (only populated for intimate_eligible characters)
      intimate_style:   { type: Sequelize.TEXT, allowNull: true }, // how they are in intimate moments
      intimate_dynamic: { type: Sequelize.TEXT, allowNull: true }, // what the dynamic is with Lala specifically
      what_lala_feels:  { type: Sequelize.TEXT, allowNull: true }, // what Lala experiences with this person

      // Arc across series
      arc_role:   { type: Sequelize.TEXT, allowNull: true }, // how they change Lala's trajectory
      exit_reason: { type: Sequelize.TEXT, allowNull: true }, // how/why they leave her world (if they do)

      // Status
      // draft | active | archived | canon
      status: { type: Sequelize.STRING(50), defaultValue: 'draft' },

      // Relationship tension with Lala (mirrors character_relationships)
      current_tension: { type: Sequelize.STRING(50), defaultValue: 'Stable' },

      // Career Echo — does this character appear in Series 2 / carry JustAWoman's content
      career_echo_connection: { type: Sequelize.BOOLEAN, defaultValue: false },
      career_echo_notes:      { type: Sequelize.TEXT, allowNull: true },

      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('world_characters', ['character_type'],    { name: 'idx_wc_type' });
    await queryInterface.addIndex('world_characters', ['status'],            { name: 'idx_wc_status' });
    await queryInterface.addIndex('world_characters', ['intimate_eligible'], { name: 'idx_wc_intimate' });
    await queryInterface.addIndex('world_characters', ['batch_id'],          { name: 'idx_wc_batch' });

    // ── 3. intimate_scenes ─────────────────────────────────────────────────
    await queryInterface.createTable('intimate_scenes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },

      // Characters involved
      character_a_id:   { type: Sequelize.UUID, allowNull: false }, // world_characters.id
      character_b_id:   { type: Sequelize.UUID, allowNull: true  }, // world_characters.id (can be one-sided POV)
      character_a_name: { type: Sequelize.STRING(255), allowNull: false },
      character_b_name: { type: Sequelize.STRING(255), allowNull: true  },

      // Links to StoryTeller for narrative placement
      book_id:    { type: Sequelize.UUID, allowNull: true },
      chapter_id: { type: Sequelize.UUID, allowNull: true }, // where it lands in the manuscript

      // Scene context
      scene_type: { type: Sequelize.STRING(100), allowNull: false }, // first_encounter | hook_up | one_night_stand | recurring | charged_moment | morning_after
      location:   { type: Sequelize.TEXT, allowNull: true },         // specific LalaVerse location
      world_context: { type: Sequelize.TEXT, allowNull: true },      // what was happening just before
      emotional_state_a: { type: Sequelize.TEXT, allowNull: true },  // where character A is emotionally entering the scene
      emotional_state_b: { type: Sequelize.TEXT, allowNull: true },

      // Arc position — shapes voice and intensity
      // early_career | rising | peak | established
      career_stage: { type: Sequelize.STRING(50), allowNull: true },

      // Tension threshold that triggered this
      trigger_tension: { type: Sequelize.STRING(50), allowNull: true }, // the tension state that fired the trigger

      // Generated content — three beats
      approach_text:   { type: Sequelize.TEXT, allowNull: true }, // the moment before
      scene_text:      { type: Sequelize.TEXT, allowNull: true }, // the scene itself
      aftermath_text:  { type: Sequelize.TEXT, allowNull: true }, // the moment after

      // Full assembled text (approach + scene + aftermath joined)
      full_text:   { type: Sequelize.TEXT, allowNull: true },
      word_count:  { type: Sequelize.INTEGER, allowNull: true },

      // Intensity level Claude calibrated to
      // charged | tender | intense | electric | quiet
      intensity:  { type: Sequelize.STRING(50), allowNull: true },

      // What shifts
      relationship_shift: { type: Sequelize.TEXT, allowNull: true }, // what changed between them

      // Post-scene automation
      tension_updated:        { type: Sequelize.BOOLEAN, defaultValue: false },
      new_tension_state:      { type: Sequelize.STRING(50), allowNull: true },
      scene_logged:           { type: Sequelize.BOOLEAN, defaultValue: false },
      memory_extracted:       { type: Sequelize.BOOLEAN, defaultValue: false },
      continuation_generated: { type: Sequelize.BOOLEAN, defaultValue: false },

      // Review status
      // draft | approved | rejected
      status: { type: Sequelize.STRING(50), defaultValue: 'draft' },

      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('intimate_scenes', ['character_a_id'], { name: 'idx_is_char_a' });
    await queryInterface.addIndex('intimate_scenes', ['scene_type'],     { name: 'idx_is_type' });
    await queryInterface.addIndex('intimate_scenes', ['status'],         { name: 'idx_is_status' });
    await queryInterface.addIndex('intimate_scenes', ['book_id'],        { name: 'idx_is_book' });

    // ── 4. scene_continuations ─────────────────────────────────────────────
    // Morning-after and story continuation prose that follows an intimate scene
    await queryInterface.createTable('scene_continuations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      scene_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'intimate_scenes', key: 'id' },
        onDelete: 'CASCADE',
      },

      continuation_type: { type: Sequelize.STRING(50), allowNull: false }, // morning_after | story_continues | time_skip | emotional_fallout

      text:        { type: Sequelize.TEXT, allowNull: false },
      word_count:  { type: Sequelize.INTEGER, allowNull: true },

      // Links to StoryTeller placement
      chapter_id: { type: Sequelize.UUID, allowNull: true },

      status: { type: Sequelize.STRING(50), defaultValue: 'draft' }, // draft | approved

      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('scene_continuations', ['scene_id'], { name: 'idx_sc_scene' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('scene_continuations');
    await queryInterface.dropTable('intimate_scenes');
    await queryInterface.dropTable('world_characters');
    await queryInterface.dropTable('world_character_batches');
  },
};
