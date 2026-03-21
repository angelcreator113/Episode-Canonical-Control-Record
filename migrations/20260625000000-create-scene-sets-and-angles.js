'use strict';

/**
 * Migration: Create scene_sets and scene_angles tables
 *
 * scene_sets  — canonical LalaVerse locations (the parent record)
 * scene_angles — individual camera angles within a set (the generatable units)
 *
 * The existing scene_library table is NOT modified — it remains for
 * production scene management. scene_sets is a separate system for
 * generative narrative scene infrastructure.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ── scene_sets ───────────────────────────────────────────────────────
      await queryInterface.createTable('scene_sets', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },

        // Franchise scope
        universe_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'universes', key: 'id' },
          onDelete: 'SET NULL',
          comment: 'Null = not yet assigned to universe. Set for franchise-level scenes.',
        },
        show_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'shows', key: 'id' },
          onDelete: 'SET NULL',
          comment: 'Null = franchise asset available to all shows. Set for show-specific scenes.',
        },

        // Identity
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'e.g. "Lala\'s Bedroom — Morning Light"',
        },
        scene_type: {
          type: Sequelize.ENUM('HOME_BASE', 'CLOSET', 'EVENT_LOCATION', 'TRANSITION', 'OTHER'),
          allowNull: false,
          comment: 'Determines which episode beats this scene serves.',
        },

        // Canonical description — the one text that feeds everything
        canonical_description: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'JAWIHP prose. Feeds: RunwayML prompt, script generator context, StoryTeller chapter drafts.',
        },
        script_context: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Shorter version of canonical_description for script generator inline use.',
        },

        // Visual language — the world aesthetic
        visual_language: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {},
          comment: 'Stores the LalaVerse visual anchor: color_language, material_language, emotional_tone, forbidden_elements.',
        },
        aesthetic_tags: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
          comment: 'e.g. ["soft-feminine", "morning-light", "lived-in", "aspirational"]',
        },
        mood_tags: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
          comment: 'e.g. ["morning", "calm", "intentional"]',
        },

        // RunwayML generation data
        base_runway_prompt: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Foundation prompt all angles build from. Derived from canonical_description.',
        },
        base_runway_seed: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'LOCKED on first successful generation. Never overwrite. Keeps room consistent.',
        },
        base_runway_model: {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'gen3a_turbo',
          comment: 'RunwayML model used for base generation.',
        },
        generation_status: {
          type: Sequelize.ENUM('pending', 'generating', 'complete', 'failed'),
          allowNull: false,
          defaultValue: 'pending',
        },
        generation_cost: {
          type: Sequelize.DECIMAL(10, 4),
          allowNull: true,
          defaultValue: 0,
          comment: 'Cumulative RunwayML API spend for this set.',
        },

        // Access control
        tier_requirement: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: 'Minimum rep level to unlock this location. 0 = always available.',
        },
        is_franchise_asset: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'True = available to all LalaVerse shows. False = this show only.',
        },
        is_unlocked: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Runtime unlock state based on Lala\'s current tier.',
        },

        // Beat compatibility
        event_compatibility: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
          comment: 'Event types this location works for, e.g. ["gallery", "gala", "showroom"].',
        },

        // Scene value taxonomy (for Director Brain scene selection)
        status_value: {
          type: Sequelize.ENUM('humble', 'aspirational', 'elite', 'intimidating'),
          allowNull: true,
          comment: 'What entering this space signals about Lala\'s position.',
        },
        intimacy_value: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: '1-10. How private/personal this space feels.',
        },
        spectacle_value: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: '1-10. How visually impressive/dramatic this space is.',
        },

        // Timestamps
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
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      }, { transaction });

      // ── scene_angles ─────────────────────────────────────────────────────
      await queryInterface.createTable('scene_angles', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },

        scene_set_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'scene_sets', key: 'id' },
          onDelete: 'CASCADE',
        },

        // Angle identity
        angle_name: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'e.g. "Wide Morning", "Vanity Close", "Window Silhouette"',
        },
        angle_label: {
          type: Sequelize.ENUM('WIDE', 'CLOSET', 'VANITY', 'WINDOW', 'DOORWAY', 'ESTABLISHING', 'ACTION', 'CLOSE', 'OVERHEAD', 'OTHER'),
          allowNull: false,
        },

        // Beat affinity — which of the 14 beats this angle serves
        beat_affinity: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
          comment: 'e.g. [1, 2, 3] — Beat numbers this angle naturally serves.',
        },
        mood: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'morning | tense | celebratory | intimate | triumphant | neutral',
        },

        // RunwayML generation
        runway_prompt: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'base_runway_prompt + angle modifier. What was actually sent to RunwayML.',
        },
        runway_seed: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Angle-specific seed. Variation of base set seed.',
        },
        runway_job_id: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'RunwayML task ID for polling generation status.',
        },
        generation_status: {
          type: Sequelize.ENUM('pending', 'generating', 'complete', 'failed'),
          allowNull: false,
          defaultValue: 'pending',
        },
        generation_cost: {
          type: Sequelize.DECIMAL(10, 4),
          allowNull: true,
          defaultValue: 0,
        },

        // Output assets (stored in S3)
        still_image_url: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'S3 URL — still frame. Used for script/book reference.',
        },
        video_clip_url: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'S3 URL — short video clip. Used for show playback.',
        },
        thumbnail_url: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'S3 URL — small preview. Used for library browsing.',
        },

        // Scene value taxonomy at angle level
        control_value: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: '1-10. How much control/agency the angle conveys.',
        },
        vulnerability_value: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: '1-10. How exposed/vulnerable the angle feels.',
        },

        // Sort order within set
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },

        // Timestamps
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
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      }, { transaction });

      // ── Indexes ───────────────────────────────────────────────────────────
      await queryInterface.addIndex('scene_sets', ['universe_id'],
        { name: 'idx_scene_sets_universe_id', transaction });
      await queryInterface.addIndex('scene_sets', ['show_id'],
        { name: 'idx_scene_sets_show_id', transaction });
      await queryInterface.addIndex('scene_sets', ['scene_type'],
        { name: 'idx_scene_sets_scene_type', transaction });
      await queryInterface.addIndex('scene_sets', ['is_franchise_asset'],
        { name: 'idx_scene_sets_franchise', transaction });
      await queryInterface.addIndex('scene_sets', ['generation_status'],
        { name: 'idx_scene_sets_gen_status', transaction });

      await queryInterface.addIndex('scene_angles', ['scene_set_id'],
        { name: 'idx_scene_angles_set_id', transaction });
      await queryInterface.addIndex('scene_angles', ['angle_label'],
        { name: 'idx_scene_angles_label', transaction });
      await queryInterface.addIndex('scene_angles', ['generation_status'],
        { name: 'idx_scene_angles_gen_status', transaction });

      await transaction.commit();
      console.log('✓ scene_sets and scene_angles tables created');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('scene_angles', { transaction });
      await queryInterface.dropTable('scene_sets', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
