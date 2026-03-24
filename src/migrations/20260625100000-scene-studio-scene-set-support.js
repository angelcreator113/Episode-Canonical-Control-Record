'use strict';

/**
 * Scene Studio — Scene Set Support
 *
 * Adds scene_set_id to scene_assets so objects can belong to a scene set (not just a scene).
 * Adds canvas_settings JSONB to scene_sets for per-set studio configuration.
 * Makes scene_id nullable on scene_assets (objects can belong to scene OR scene set).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add scene_set_id to scene_assets
    await queryInterface.addColumn('scene_assets', 'scene_set_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'scene_sets', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'Scene set this object belongs to (alternative to scene_id)',
    });

    await queryInterface.addIndex('scene_assets', ['scene_set_id'], {
      name: 'idx_scene_assets_scene_set_id',
    });

    // 2. Add scene_angle_id to scene_assets (which angle is the background context)
    await queryInterface.addColumn('scene_assets', 'scene_angle_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'scene_angles', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Which angle this object is placed on (for angle-specific objects)',
    });

    await queryInterface.addIndex('scene_assets', ['scene_angle_id'], {
      name: 'idx_scene_assets_scene_angle_id',
    });

    // 3. Make scene_id nullable (objects can belong to scene_set instead)
    await queryInterface.changeColumn('scene_assets', 'scene_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'scenes', key: 'id' },
      onDelete: 'CASCADE',
    });

    // 4. Add canvas_settings to scene_sets
    await queryInterface.addColumn('scene_sets', 'canvas_settings', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Scene Studio canvas settings for this scene set',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('scene_sets', 'canvas_settings');

    // Restore scene_id as NOT NULL (delete orphans first)
    await queryInterface.sequelize.query(
      `DELETE FROM scene_assets WHERE scene_id IS NULL`
    );
    await queryInterface.changeColumn('scene_assets', 'scene_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'scenes', key: 'id' },
      onDelete: 'CASCADE',
    });

    await queryInterface.removeIndex('scene_assets', 'idx_scene_assets_scene_angle_id').catch(() => {});
    await queryInterface.removeColumn('scene_assets', 'scene_angle_id');

    await queryInterface.removeIndex('scene_assets', 'idx_scene_assets_scene_set_id').catch(() => {});
    await queryInterface.removeColumn('scene_assets', 'scene_set_id');
  },
};
