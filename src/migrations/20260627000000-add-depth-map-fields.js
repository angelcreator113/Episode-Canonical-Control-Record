'use strict';

/**
 * Migration: Add depth estimation fields to scene_angles
 *
 * Supports the depth estimation pipeline — stores generated depth map URLs
 * and tracks estimation status per angle.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if table/columns already exist (idempotent)
      const tableDesc = await queryInterface.describeTable('scene_angles').catch(() => null);
      if (!tableDesc) {
        console.log('[Migration] scene_angles table does not exist — skipping');
        await transaction.commit();
        return;
      }

      if (!tableDesc.depth_map_url) {
        await queryInterface.addColumn('scene_angles', 'depth_map_url', {
          type: Sequelize.TEXT,
          allowNull: true,
        }, { transaction });
      }

      if (!tableDesc.depth_status) {
        await queryInterface.addColumn('scene_angles', 'depth_status', {
          type: Sequelize.ENUM('pending', 'generating', 'complete', 'failed'),
          allowNull: true,
          defaultValue: null,
        }, { transaction });
      }

      await transaction.commit();
      console.log('[Migration] Added depth_map_url and depth_status to scene_angles');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeColumn('scene_angles', 'depth_map_url', { transaction });
      await queryInterface.removeColumn('scene_angles', 'depth_status', { transaction });

      // Clean up ENUM type
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_scene_angles_depth_status";',
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
