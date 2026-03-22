'use strict';

/**
 * Migration: Create missing tables — batch 2
 *
 * Tables: scene_templates, timeline_data, hair_library, makeup_library,
 *         character_growth_log, book_series
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ── scene_templates ──────────────────────────────────────────────
      await queryInterface.createTable('scene_templates', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING(200),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        scene_type: {
          type: Sequelize.STRING(50),
          allowNull: true,
          defaultValue: 'main',
        },
        mood: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },
        location: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        duration_seconds: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        structure: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {},
        },
        default_settings: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {},
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        is_public: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('scene_templates', ['created_by'],
        { name: 'idx_scene_templates_created_by', transaction });
      await queryInterface.addIndex('scene_templates', ['is_public'],
        { name: 'idx_scene_templates_is_public', transaction });
      await queryInterface.addIndex('scene_templates', ['scene_type'],
        { name: 'idx_scene_templates_scene_type', transaction });

      // ── timeline_data ────────────────────────────────────────────────
      await queryInterface.createTable('timeline_data', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        episode_id: {
          type: Sequelize.UUID,
          allowNull: false,
          unique: true,
          references: { model: 'episodes', key: 'id' },
          onDelete: 'CASCADE',
        },
        beats: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        markers: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        audio_clips: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        character_clips: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        keyframes: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      // ── hair_library ─────────────────────────────────────────────────
      await queryInterface.createTable('hair_library', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        show_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'shows', key: 'id' },
          onDelete: 'CASCADE',
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        vibe_tags: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        occasion_tags: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        event_types: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        reference_photo_url: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        color_state: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        length: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        texture: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        career_echo_potential: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        is_justAWoman_style: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('hair_library', ['show_id'],
        { name: 'idx_hair_library_show_id', transaction });

      // ── makeup_library ───────────────────────────────────────────────
      await queryInterface.createTable('makeup_library', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        show_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'shows', key: 'id' },
          onDelete: 'CASCADE',
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        mood_tag: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        occasion_tags: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        event_types: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        aesthetic_tags: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
        },
        skin_finish: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        eye_look: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        lip_look: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        reference_photo_url: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        career_echo_potential: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        is_justAWoman_style: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        featured_brand: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('makeup_library', ['show_id'],
        { name: 'idx_makeup_library_show_id', transaction });

      // ── character_growth_log ─────────────────────────────────────────
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_character_growth_log_update_type" AS ENUM ('silent', 'flagged_contradiction');`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_character_growth_log_author_decision" AS ENUM ('accepted', 'reverted', 'modified');`,
        { transaction }
      );

      await queryInterface.createTable('character_growth_log', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        character_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        story_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        scene_proposal_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
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
          allowNull: false,
          defaultValue: 'silent',
        },
        growth_source: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        author_reviewed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
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
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('character_growth_log', ['character_id'],
        { name: 'idx_character_growth_character', transaction });

      // ── book_series ──────────────────────────────────────────────────
      await queryInterface.createTable('book_series', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        universe_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'universes', key: 'id' },
          onDelete: 'CASCADE',
        },
        show_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'shows', key: 'id' },
          onDelete: 'SET NULL',
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        order_index: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        protagonist_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('book_series', ['universe_id'],
        { name: 'idx_book_series_universe', transaction });

      await transaction.commit();
      console.log('✓ Created: scene_templates, timeline_data, hair_library, makeup_library, character_growth_log, book_series');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('book_series', { transaction });
      await queryInterface.dropTable('character_growth_log', { transaction });
      await queryInterface.dropTable('makeup_library', { transaction });
      await queryInterface.dropTable('hair_library', { transaction });
      await queryInterface.dropTable('timeline_data', { transaction });
      await queryInterface.dropTable('scene_templates', { transaction });

      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_character_growth_log_update_type";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_character_growth_log_author_decision";',
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
