'use strict';

/**
 * Migration: Story Persistence + Social Import + Novel Assembler
 * Creates 3 tables: storyteller_stories, social_media_imports, novel_assemblies
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. storyteller_stories ─────────────────────────────────────────────
    await queryInterface.createTable('storyteller_stories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      character_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'justawoman, david, dana, chloe, jade, lala',
      },
      story_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '1-50 within the arc',
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      phase: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'establishment, pressure, crisis, integration',
      },
      story_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'internal, collision, wrong_win',
      },
      word_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'draft',
        comment: 'draft, approved, rejected, published',
      },
      task_brief: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Original task brief from story engine',
      },
      consistency_result: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Last consistency check result',
      },
      therapy_memories: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Extracted therapy memories',
      },
      new_character: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      new_character_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      new_character_role: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      opening_line: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      editor_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      version: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        allowNull: true,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('storyteller_stories', ['character_key'], {
      name: 'idx_stories_char_key',
    });
    await queryInterface.addIndex('storyteller_stories', ['character_key', 'story_number'], {
      name: 'idx_stories_char_num',
      unique: true,
    });
    await queryInterface.addIndex('storyteller_stories', ['status'], {
      name: 'idx_stories_status',
    });
    await queryInterface.addIndex('storyteller_stories', ['phase'], {
      name: 'idx_stories_phase',
    });

    // ── 2. social_media_imports ────────────────────────────────────────────
    await queryInterface.createTable('social_media_imports', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      character_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      platform: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'instagram, twitter, tiktok, youtube, reddit, custom',
      },
      source_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      raw_content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Original pasted/imported content',
      },
      detected_voice: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'AI-detected voice/persona',
      },
      lala_detected: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether Lala emergence was detected',
      },
      lala_markers: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Array of Lala emergence markers found',
      },
      parsed_content: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'AI-parsed structured content',
      },
      emotional_tags: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Array of emotional tone tags',
      },
      canon_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'pending, canon, rejected, archived',
      },
      assigned_story_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'storyteller_stories', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        comment: 'Link to story this import feeds into',
      },
      import_batch: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Batch identifier for bulk imports',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        allowNull: true,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('social_media_imports', ['character_key'], {
      name: 'idx_social_char_key',
    });
    await queryInterface.addIndex('social_media_imports', ['platform'], {
      name: 'idx_social_platform',
    });
    await queryInterface.addIndex('social_media_imports', ['canon_status'], {
      name: 'idx_social_canon_status',
    });
    await queryInterface.addIndex('social_media_imports', ['lala_detected'], {
      name: 'idx_social_lala',
    });

    // ── 3. novel_assemblies ────────────────────────────────────────────────
    await queryInterface.createTable('novel_assemblies', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      character_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      story_ids: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Ordered array of story UUIDs included in this assembly',
      },
      social_import_ids: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Social import UUIDs woven in',
      },
      assembly_order: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Custom ordering: [{type: "story"|"import", id: uuid, position: int}]',
      },
      emotional_curve: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Computed emotional arc data for visualization',
      },
      total_word_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      chapter_breaks: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Where chapter breaks fall in the assembly',
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'draft',
        comment: 'draft, assembling, review, published',
      },
      compiled_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Full compiled novel text (cached)',
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Additional metadata: themes, settings, timeline coverage',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        allowNull: true,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('novel_assemblies', ['character_key'], {
      name: 'idx_novel_char_key',
    });
    await queryInterface.addIndex('novel_assemblies', ['status'], {
      name: 'idx_novel_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('novel_assemblies');
    await queryInterface.dropTable('social_media_imports');
    await queryInterface.dropTable('storyteller_stories');
  },
};
