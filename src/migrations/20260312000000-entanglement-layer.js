'use strict';
/** ─────────────────────────────────────────────────────────────────────────────
 * Migration: Entanglement Layer
 * Creates:
 *   - character_entanglements      (character ↔ influencer links)
 *   - entanglement_events          (ripple log — state changes + content events)
 *   - entanglement_unfollows       (unfollow as narrative event)
 * Extends:
 *   - social_profiles              (current_state, previous_state, state_changed_at)
 * ─────────────────────────────────────────────────────────────────────────────
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. Extend social_profiles with state tracking ──────────────────────
    await queryInterface.addColumn('social_profiles', 'current_state', {
      type: Sequelize.ENUM(
        'rising', 'peaking', 'plateauing', 'controversial',
        'cancelled', 'reinventing', 'gone_dark', 'posthumous'
      ),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('social_profiles', 'previous_state', {
      type: Sequelize.ENUM(
        'rising', 'peaking', 'plateauing', 'controversial',
        'cancelled', 'reinventing', 'gone_dark', 'posthumous'
      ),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('social_profiles', 'state_changed_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    // ── 2. character_entanglements ─────────────────────────────────────────
    await queryInterface.createTable('character_entanglements', {
      id: {
        type:          Sequelize.UUID,
        defaultValue:  Sequelize.UUIDV4,
        primaryKey:    true,
      },
      character_id: {
        type:       Sequelize.UUID,
        allowNull:  false,
        references: { model: 'registry_characters', key: 'id' },
        onDelete:   'CASCADE',
      },
      profile_id: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'social_profiles', key: 'id' },
        onDelete:   'CASCADE',
      },
      // Which of the 14 Deep Profile dimensions this entanglement touches
      dimension: {
        type: Sequelize.ENUM(
          'ambition_identity', 'the_body', 'class_money',
          'religion_meaning', 'race_culture', 'sexuality_desire',
          'family_architecture', 'friendship_loyalty', 'habits_rituals',
          'speech_silence', 'grief_loss', 'politics_justice', 'the_unseen',
          'life_stage'
        ),
        allowNull: false,
      },
      // How load-bearing is this influencer to the character
      intensity: {
        type:         Sequelize.ENUM('peripheral', 'moderate', 'significant', 'identity_anchor'),
        allowNull:    false,
        defaultValue: 'peripheral',
      },
      // Does the character know the influencer? Does the influencer know them?
      directionality: {
        type:         Sequelize.ENUM('character_knows', 'mutual', 'neither'),
        allowNull:    false,
        defaultValue: 'character_knows',
      },
      // The nature of the entanglement
      entanglement_type: {
        type:      Sequelize.ENUM('knows_in_real_life', 'writes_about', 'identity_anchor'),
        allowNull: false,
      },
      is_active: {
        type:         Sequelize.BOOLEAN,
        allowNull:    false,
        defaultValue: true,
      },
      // Flag: this character is currently affected by a recent influencer event
      turbulence_flag: {
        type:         Sequelize.BOOLEAN,
        allowNull:    false,
        defaultValue: false,
      },
      turbulence_reason: {
        type:      Sequelize.TEXT,
        allowNull: true,
      },
      // Amber-proposed — author must confirm before it becomes authoritative
      amber_proposed: {
        type:         Sequelize.BOOLEAN,
        allowNull:    false,
        defaultValue: false,
      },
      notes: {
        type:      Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
    // Indexes
    await queryInterface.addIndex('character_entanglements', ['character_id']);
    await queryInterface.addIndex('character_entanglements', ['profile_id']);
    await queryInterface.addIndex('character_entanglements', ['intensity']);
    await queryInterface.addIndex('character_entanglements', ['entanglement_type']);
    await queryInterface.addIndex('character_entanglements', ['turbulence_flag']);
    await queryInterface.addIndex('character_entanglements', ['is_active']);
    // One entanglement type per character-profile pair
    await queryInterface.addIndex('character_entanglements',
      ['character_id', 'profile_id', 'entanglement_type'],
      { unique: true, name: 'ce_unique_char_profile_type' }
    );
    // ── 3. entanglement_events (ripple log) ────────────────────────────────
    await queryInterface.createTable('entanglement_events', {
      id: {
        type:         Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey:   true,
      },
      profile_id: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'social_profiles', key: 'id' },
        onDelete:   'CASCADE',
      },
      event_type: {
        type: Sequelize.ENUM(
          'post', 'collab', 'callout', 'rebrand', 'scandal',
          'silence', 'disappearance', 'state_change'
        ),
        allowNull: false,
      },
      previous_state: {
        type: Sequelize.ENUM(
          'rising', 'peaking', 'plateauing', 'controversial',
          'cancelled', 'reinventing', 'gone_dark', 'posthumous'
        ),
        allowNull: true,
      },
      new_state: {
        type: Sequelize.ENUM(
          'rising', 'peaking', 'plateauing', 'controversial',
          'cancelled', 'reinventing', 'gone_dark', 'posthumous'
        ),
        allowNull: true,
      },
      // Array of registry_character UUIDs flagged by this event
      affected_character_ids: {
        type:         Sequelize.JSONB,
        allowNull:    false,
        defaultValue: [],
      },
      // Which Deep Profile dimensions activated across those characters
      affected_dimensions: {
        type:         Sequelize.JSONB,
        allowNull:    false,
        defaultValue: [],
      },
      // Amber-generated scene briefs for flagged characters
      scene_proposals: {
        type:         Sequelize.JSONB,
        allowNull:    true,
        defaultValue: null,
        comment:      'Array of { character_id, brief, approved } objects',
      },
      description: {
        type:      Sequelize.TEXT,
        allowNull: true,
      },
      resolved: {
        type:         Sequelize.BOOLEAN,
        allowNull:    false,
        defaultValue: false,
      },
      created_at: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
    await queryInterface.addIndex('entanglement_events', ['profile_id']);
    await queryInterface.addIndex('entanglement_events', ['event_type']);
    await queryInterface.addIndex('entanglement_events', ['resolved']);
    await queryInterface.addIndex('entanglement_events', ['created_at']);
    // ── 4. entanglement_unfollows ──────────────────────────────────────────
    await queryInterface.createTable('entanglement_unfollows', {
      id: {
        type:         Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey:   true,
      },
      character_id: {
        type:       Sequelize.UUID,
        allowNull:  false,
        references: { model: 'registry_characters', key: 'id' },
        onDelete:   'CASCADE',
      },
      profile_id: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'social_profiles', key: 'id' },
        onDelete:   'CASCADE',
      },
      reason: {
        type: Sequelize.ENUM(
          'disillusionment', 'protection', 'growth',
          'conflict', 'drama'
        ),
        allowNull: true,
      },
      // Where in the narrative this happened — story time, not real time
      story_timestamp: {
        type:      Sequelize.TEXT,
        allowNull: true,
        comment:   'e.g. "Chapter 3, after the salon scene" — narrative position',
      },
      // Array of character UUIDs who noticed this unfollow
      noticed_by: {
        type:         Sequelize.JSONB,
        allowNull:    false,
        defaultValue: [],
      },
      visibility: {
        type:         Sequelize.ENUM('public', 'private', 'unnoticed'),
        allowNull:    false,
        defaultValue: 'unnoticed',
      },
      // Amber-proposed reason — author must confirm
      amber_proposed_reason: {
        type:      Sequelize.TEXT,
        allowNull: true,
      },
      author_confirmed: {
        type:         Sequelize.BOOLEAN,
        allowNull:    false,
        defaultValue: false,
      },
      notes: {
        type:      Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
    await queryInterface.addIndex('entanglement_unfollows', ['character_id']);
    await queryInterface.addIndex('entanglement_unfollows', ['profile_id']);
    await queryInterface.addIndex('entanglement_unfollows', ['visibility']);
    await queryInterface.addIndex('entanglement_unfollows', ['author_confirmed']);
    // One unfollow record per character-profile pair (can't unfollow twice)
    await queryInterface.addIndex('entanglement_unfollows',
      ['character_id', 'profile_id'],
      { unique: true, name: 'eu_unique_char_profile' }
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('entanglement_unfollows');
    await queryInterface.dropTable('entanglement_events');
    await queryInterface.dropTable('character_entanglements');
    await queryInterface.removeColumn('social_profiles', 'state_changed_at');
    await queryInterface.removeColumn('social_profiles', 'previous_state');
    await queryInterface.removeColumn('social_profiles', 'current_state');
  },
};
