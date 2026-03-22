'use strict';

/**
 * Migration: Add missing columns to scene_sets and scene_angles
 *
 * These columns exist in the Sequelize models but were not included
 * in the original create-table migration, causing 500 errors on queries.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ── scene_sets: missing columns ────────────────────────────────────
      await queryInterface.addColumn('scene_sets', 'style_reference_url', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('scene_sets', 'negative_prompt', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('scene_sets', 'variation_count', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      }, { transaction });

      // ── scene_angles: missing columns ──────────────────────────────────
      await queryInterface.addColumn('scene_angles', 'angle_description', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'camera_direction', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'quality_score', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'artifact_flags', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'quality_review', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'generation_attempt', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'refined_prompt', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'camera_motion', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'video_duration', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 5,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'style_reference_url', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'variation_count', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'variation_data', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      }, { transaction });

      // Create the ENUM type first, then add the column
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_scene_angles_post_processing_status" AS ENUM ('pending', 'processing', 'complete', 'failed');`,
        { transaction }
      );

      await queryInterface.addColumn('scene_angles', 'post_processing_status', {
        type: Sequelize.ENUM('pending', 'processing', 'complete', 'failed'),
        allowNull: true,
        defaultValue: 'pending',
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'enhanced_still_url', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('scene_angles', 'enhanced_video_url', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await transaction.commit();
      console.log('✓ Added missing columns to scene_sets and scene_angles');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // scene_sets
      await queryInterface.removeColumn('scene_sets', 'style_reference_url', { transaction });
      await queryInterface.removeColumn('scene_sets', 'negative_prompt', { transaction });
      await queryInterface.removeColumn('scene_sets', 'variation_count', { transaction });

      // scene_angles
      await queryInterface.removeColumn('scene_angles', 'angle_description', { transaction });
      await queryInterface.removeColumn('scene_angles', 'camera_direction', { transaction });
      await queryInterface.removeColumn('scene_angles', 'quality_score', { transaction });
      await queryInterface.removeColumn('scene_angles', 'artifact_flags', { transaction });
      await queryInterface.removeColumn('scene_angles', 'quality_review', { transaction });
      await queryInterface.removeColumn('scene_angles', 'generation_attempt', { transaction });
      await queryInterface.removeColumn('scene_angles', 'refined_prompt', { transaction });
      await queryInterface.removeColumn('scene_angles', 'camera_motion', { transaction });
      await queryInterface.removeColumn('scene_angles', 'video_duration', { transaction });
      await queryInterface.removeColumn('scene_angles', 'style_reference_url', { transaction });
      await queryInterface.removeColumn('scene_angles', 'variation_count', { transaction });
      await queryInterface.removeColumn('scene_angles', 'variation_data', { transaction });
      await queryInterface.removeColumn('scene_angles', 'post_processing_status', { transaction });
      await queryInterface.removeColumn('scene_angles', 'enhanced_still_url', { transaction });
      await queryInterface.removeColumn('scene_angles', 'enhanced_video_url', { transaction });

      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_scene_angles_post_processing_status";',
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
