'use strict';

/**
 * Migration: Create scene_sets and scene_angles tables
 *
 * These tables were previously created via sequelize.sync() (ENABLE_DB_SYNC),
 * but need explicit migrations for CI and fresh environments.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── scene_sets ──────────────────────────────────────────────────────
    const setsExists = await queryInterface.describeTable('scene_sets').catch(() => null);
    if (!setsExists) {
      await queryInterface.createTable('scene_sets', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        universe_id: { type: Sequelize.UUID, allowNull: true },
        show_id: { type: Sequelize.UUID, allowNull: true },
        name: { type: Sequelize.STRING, allowNull: false },
        scene_type: {
          type: Sequelize.ENUM('HOME_BASE', 'CLOSET', 'EVENT_LOCATION', 'TRANSITION', 'OTHER'),
          allowNull: false,
        },
        canonical_description: { type: Sequelize.TEXT, allowNull: true },
        script_context: { type: Sequelize.TEXT, allowNull: true },
        visual_language: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
        aesthetic_tags: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
        mood_tags: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
        base_runway_prompt: { type: Sequelize.TEXT, allowNull: true },
        base_runway_seed: { type: Sequelize.STRING, allowNull: true },
        base_runway_model: { type: Sequelize.STRING, allowNull: true, defaultValue: 'gen3a_turbo' },
        base_still_url: { type: Sequelize.TEXT, allowNull: true },
        generation_status: {
          type: Sequelize.ENUM('pending', 'generating', 'complete', 'failed'),
          allowNull: false,
          defaultValue: 'pending',
        },
        generation_cost: { type: Sequelize.DECIMAL(10, 4), allowNull: true, defaultValue: 0 },
        tier_requirement: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        is_franchise_asset: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_unlocked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        event_compatibility: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
        status_value: {
          type: Sequelize.ENUM('humble', 'aspirational', 'elite', 'intimidating'),
          allowNull: true,
        },
        intimacy_value: { type: Sequelize.INTEGER, allowNull: true },
        spectacle_value: { type: Sequelize.INTEGER, allowNull: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });

      await queryInterface.addIndex('scene_sets', ['universe_id']);
      await queryInterface.addIndex('scene_sets', ['show_id']);
      await queryInterface.addIndex('scene_sets', ['scene_type']);
    }

    // ── scene_angles ────────────────────────────────────────────────────
    const anglesExists = await queryInterface.describeTable('scene_angles').catch(() => null);
    if (!anglesExists) {
      await queryInterface.createTable('scene_angles', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        scene_set_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'scene_sets', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        angle_name: { type: Sequelize.STRING, allowNull: false },
        angle_label: {
          type: Sequelize.ENUM('WIDE', 'CLOSET', 'VANITY', 'WINDOW', 'DOORWAY', 'ESTABLISHING', 'ACTION', 'CLOSE', 'OVERHEAD', 'OTHER'),
          allowNull: false,
        },
        angle_description: { type: Sequelize.TEXT, allowNull: true },
        camera_direction: { type: Sequelize.TEXT, allowNull: true },
        beat_affinity: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
        mood: { type: Sequelize.STRING, allowNull: true },
        runway_prompt: { type: Sequelize.TEXT, allowNull: true },
        runway_seed: { type: Sequelize.STRING, allowNull: true },
        runway_job_id: { type: Sequelize.STRING, allowNull: true },
        generation_status: {
          type: Sequelize.ENUM('pending', 'generating', 'complete', 'failed'),
          allowNull: false,
          defaultValue: 'pending',
        },
        generation_cost: { type: Sequelize.DECIMAL(10, 4), allowNull: true, defaultValue: 0 },
        still_image_url: { type: Sequelize.TEXT, allowNull: true },
        video_clip_url: { type: Sequelize.TEXT, allowNull: true },
        thumbnail_url: { type: Sequelize.TEXT, allowNull: true },
        quality_score: { type: Sequelize.INTEGER, allowNull: true },
        artifact_flags: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
        quality_review: { type: Sequelize.JSONB, allowNull: true, defaultValue: null },
        generation_attempt: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        refined_prompt: { type: Sequelize.TEXT, allowNull: true },
        control_value: { type: Sequelize.INTEGER, allowNull: true },
        vulnerability_value: { type: Sequelize.INTEGER, allowNull: true },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });

      await queryInterface.addIndex('scene_angles', ['scene_set_id']);
      await queryInterface.addIndex('scene_angles', ['generation_status']);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('scene_angles').catch(() => {});
    await queryInterface.dropTable('scene_sets').catch(() => {});
  },
};
