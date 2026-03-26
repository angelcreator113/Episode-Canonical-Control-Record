'use strict';

module.exports = {
  async up(queryInterface, _Sequelize) {

    // ── scene_proposals ───────────────────────────────────────────────────────
    await queryInterface.createTable('scene_proposals', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      book_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'storyteller_books', key: 'id' },
        onDelete: 'SET NULL',
      },
      chapter_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'storyteller_chapters', key: 'id' },
        onDelete: 'SET NULL',
      },
      registry_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'character_registries', key: 'id' },
        onDelete: 'SET NULL',
      },

      // ── What the system read to generate this proposal ───────────────────
      arc_stage: {
        type: Sequelize.ENUM('establishment', 'pressure', 'crisis', 'integration'),
        allowNull: true,
      },
      arc_stage_score: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Counts of approved scenes per arc stage at time of proposal',
      },
      wounds_unaddressed: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Character wounds not touched in recent scenes — drove character selection',
      },
      tensions_unresolved: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Relationship tension states that fed this proposal',
      },
      recent_beats: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Last N continuity beats read before generation',
      },
      recent_revelations: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Recent character revelation memories that informed the proposal',
      },

      // ── The proposal itself ──────────────────────────────────────────────
      scene_type: {
        type: Sequelize.ENUM(
          'production_breakdown',
          'creator_study',
          'interior_reckoning',
          'david_mirror',
          'paying_man_pressure',
          'bestie_moment',
          'lala_seed',
          'general'
        ),
        allowNull: false,
        defaultValue: 'general',
      },
      proposed_characters: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of { character_id, character_name, role_in_scene, why_now }',
      },
      emotional_stakes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What is actually at stake emotionally — not plot, feeling',
      },
      arc_function: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What this scene advances in the arc — what changes because of it',
      },
      scene_brief: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'The fully written scene brief — editable by author before firing',
      },
      why_these_characters: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'System reasoning — why this cast at this moment in the arc',
      },
      suggested_tone: {
        type: Sequelize.ENUM('longing', 'tension', 'sensual', 'explicit', 'aftermath'),
        allowNull: true,
        defaultValue: 'tension',
      },
      lala_seed_potential: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'System flagged this as a likely Lala emergence moment',
      },

      // ── Author interaction ───────────────────────────────────────────────
      status: {
        type: Sequelize.ENUM('proposed', 'adjusted', 'accepted', 'dismissed', 'generated'),
        defaultValue: 'proposed',
      },
      author_edits: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'What the author changed before accepting — brief edits, character swaps',
      },
      final_brief: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'The brief actually sent to generation — original or author-edited',
      },
      final_characters: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Final character list after author adjustments',
      },
      story_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Set when this proposal fires into the story engine',
      },

      // ── Raw system output ────────────────────────────────────────────────
      raw_proposal: {
        type: Sequelize.JSONB,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('scene_proposals', ['book_id']);
    await queryInterface.addIndex('scene_proposals', ['chapter_id']);
    await queryInterface.addIndex('scene_proposals', ['status']);
    await queryInterface.addIndex('scene_proposals', ['scene_type']);
    await queryInterface.addIndex('scene_proposals', ['arc_stage']);

    // ── character_growth_log ──────────────────────────────────────────────
    await queryInterface.createTable('character_growth_log', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      character_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'CASCADE',
      },
      story_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'The story that triggered this growth update',
      },
      scene_proposal_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'scene_proposals', key: 'id' },
        onDelete: 'SET NULL',
      },

      // ── What changed ────────────────────────────────────────────────────
      field_updated: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      previous_value: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      new_value: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      update_type: {
        type: Sequelize.ENUM('silent', 'flagged_contradiction'),
        defaultValue: 'silent',
        comment: 'silent = applied automatically | flagged = author must review',
      },
      growth_source: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What in the scene triggered this growth — specific revelation or behavior',
      },

      // ── Author review (flagged only) ─────────────────────────────────────
      author_reviewed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      author_decision: {
        type: Sequelize.ENUM('accepted', 'reverted', 'modified'),
        allowNull: true,
      },
      author_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('character_growth_log', ['character_id']);
    await queryInterface.addIndex('character_growth_log', ['update_type']);
    await queryInterface.addIndex('character_growth_log', ['author_reviewed']);

    // ── arc_stage_tracker on storyteller_books ────────────────────────────
    await queryInterface.addColumn('storyteller_books', 'current_arc_stage', {
      type: Sequelize.ENUM('establishment', 'pressure', 'crisis', 'integration'),
      allowNull: true,
      defaultValue: 'establishment',
    });
    await queryInterface.addColumn('storyteller_books', 'arc_stage_scores', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: { establishment: 0, pressure: 0, crisis: 0, integration: 0 },
      comment: 'Count of approved scenes per arc stage — drives Scene Proposer intelligence',
    });
    await queryInterface.addColumn('storyteller_books', 'book1_throughline', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Franchise Bible context injected into scene proposer — production gap, creator mirror, identity protection',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('character_growth_log');
    await queryInterface.dropTable('scene_proposals');
    await queryInterface.removeColumn('storyteller_books', 'current_arc_stage');
    await queryInterface.removeColumn('storyteller_books', 'arc_stage_scores');
    await queryInterface.removeColumn('storyteller_books', 'book1_throughline');

    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_scene_proposals_arc_stage";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_scene_proposals_scene_type";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_scene_proposals_status";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_scene_proposals_suggested_tone";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_character_growth_log_update_type";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_character_growth_log_author_decision";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_storyteller_books_current_arc_stage";`);
  },
};
