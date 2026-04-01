'use strict';

/**
 * Migration: Add canvas_settings column to scenes table
 *
 * Scene Studio stores canvas state (zoom, pan, grid, depth effects, etc.)
 * in this JSONB column. Without it, all Scene Studio saves silently fail
 * because the UPDATE query aborts the PostgreSQL transaction.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add canvas_settings to scenes if it doesn't exist
    const [sceneCols] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'scenes' AND column_name = 'canvas_settings'`
    );
    if (sceneCols.length === 0) {
      await queryInterface.addColumn('scenes', 'canvas_settings', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      });
      console.log('Added canvas_settings column to scenes');
    } else {
      console.log('canvas_settings column already exists on scenes');
    }

    // Also add to scene_sets if it doesn't exist
    const [setsCols] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'scene_sets' AND column_name = 'canvas_settings'`
    );
    if (setsCols.length === 0) {
      await queryInterface.addColumn('scene_sets', 'canvas_settings', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      });
      console.log('Added canvas_settings column to scene_sets');
    } else {
      console.log('canvas_settings column already exists on scene_sets');
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('scenes', 'canvas_settings');
    await queryInterface.removeColumn('scene_sets', 'canvas_settings');
  },
};
