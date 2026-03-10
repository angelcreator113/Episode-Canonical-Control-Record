'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. social_profile_followers — many-to-many: characters ↔ profiles ──
    await queryInterface.createTable('social_profile_followers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      social_profile_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'social_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      character_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Protagonist key (e.g. justawoman, lala) — not FK to registry, these are story protagonists',
      },
      character_name: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'Display name of the character at time of follow',
      },
      follow_context: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Why this character follows them — jealousy, aspiration, hate-watching, etc.',
      },
      emotional_reaction: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What this profile triggers in that specific character',
      },
      influence_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'aspiration | envy | comfort | obsession | competition | mirror | escape',
      },
      influence_level: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 5,
        comment: '1-10: how much this profile affects the character\'s decisions/mood',
      },
      discovered_in: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Story context where this character found this profile (chapter, scene, etc.)',
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Unique compound: one character follows a profile only once
    await queryInterface.addIndex('social_profile_followers', ['social_profile_id', 'character_key'], {
      unique: true,
      name: 'spf_profile_character_unique',
    });
    await queryInterface.addIndex('social_profile_followers', ['character_key'], {
      name: 'spf_character_key_idx',
    });

    // ── 2. bulk_import_jobs — background job queue for bulk generation ──
    await queryInterface.createTable('bulk_import_jobs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'pending | processing | completed | failed',
      },
      total: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      completed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      failed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      candidates: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of { handle, platform, vibe_sentence } objects',
      },
      results: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of { handle, platform, status, profile_id, error } results',
      },
      character_context: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Protagonist context used for generation',
      },
      character_key: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Which protagonist initiated this import',
      },
      series_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('bulk_import_jobs', ['status'], {
      name: 'bij_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bulk_import_jobs');
    await queryInterface.dropTable('social_profile_followers');
  },
};
