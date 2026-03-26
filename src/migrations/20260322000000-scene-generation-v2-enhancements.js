'use strict';

/**
 * Migration: Scene Generation v2.0 enhancements
 *
 * Adds columns for:
 *   - Camera motion control
 *   - Video duration per angle
 *   - Style reference images
 *   - Multi-variation generation
 *   - Post-processing pipeline status
 *   - Enhanced asset URLs
 *   - Negative prompt on SceneSet
 */
module.exports = {
  async up(queryInterface, _Sequelize) {
    // ── SceneAngle new columns ──────────────────────────────────────────
    const angleTable = await queryInterface.describeTable('scene_angles').catch(() => null);
    if (!angleTable) return;

    const angleColumns = [
      ['camera_motion', { type: Sequelize.STRING, allowNull: true }],
      ['video_duration', { type: Sequelize.INTEGER, allowNull: true, defaultValue: 5 }],
      ['style_reference_url', { type: Sequelize.TEXT, allowNull: true }],
      ['variation_count', { type: Sequelize.INTEGER, allowNull: true, defaultValue: 1 }],
      ['variation_data', { type: Sequelize.JSONB, allowNull: true, defaultValue: null }],
      ['enhanced_still_url', { type: Sequelize.TEXT, allowNull: true }],
      ['enhanced_video_url', { type: Sequelize.TEXT, allowNull: true }],
    ];

    for (const [col, def] of angleColumns) {
      if (!angleTable[col]) {
        await queryInterface.addColumn('scene_angles', col, def);
      }
    }

    // post_processing_status ENUM
    if (!angleTable.post_processing_status) {
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE "enum_scene_angles_post_processing_status" AS ENUM ('pending', 'processing', 'complete', 'failed');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await queryInterface.addColumn('scene_angles', 'post_processing_status', {
        type: Sequelize.ENUM('pending', 'processing', 'complete', 'failed'),
        allowNull: true,
        defaultValue: 'pending',
      });
    }

    // ── SceneSet new columns ────────────────────────────────────────────
    const setTable = await queryInterface.describeTable('scene_sets').catch(() => null);
    if (!setTable) return;

    const setColumns = [
      ['style_reference_url', { type: Sequelize.TEXT, allowNull: true }],
      ['negative_prompt', { type: Sequelize.TEXT, allowNull: true }],
      ['variation_count', { type: Sequelize.INTEGER, allowNull: true, defaultValue: 1 }],
    ];

    for (const [col, def] of setColumns) {
      if (!setTable[col]) {
        await queryInterface.addColumn('scene_sets', col, def);
      }
    }
  },

  async down(queryInterface, _Sequelize) {
    const angleColumns = [
      'camera_motion', 'video_duration', 'style_reference_url',
      'variation_count', 'variation_data', 'post_processing_status',
      'enhanced_still_url', 'enhanced_video_url',
    ];
    for (const col of angleColumns) {
      await queryInterface.removeColumn('scene_angles', col).catch(() => {});
    }
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_scene_angles_post_processing_status";'
    ).catch(() => {});

    const setColumns = ['style_reference_url', 'negative_prompt', 'variation_count'];
    for (const col of setColumns) {
      await queryInterface.removeColumn('scene_sets', col).catch(() => {});
    }
  },
};
