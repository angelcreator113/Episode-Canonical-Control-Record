'use strict';

/**
 * Add is_home flag to ui_overlay_types and style_prefix to shows.
 * is_home: marks which screen is the default landing page for the phone.
 * style_prefix: per-show design language for AI image generation prompts.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add is_home boolean to overlay types
    await queryInterface.addColumn('ui_overlay_types', 'is_home', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this screen is the phone home screen (only one per show)',
    });

    // Add style_prefix to shows for per-show generation style
    // Use IF NOT EXISTS to handle cases where column may already exist
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE shows ADD COLUMN IF NOT EXISTS style_prefix TEXT DEFAULT NULL`
      );
      await queryInterface.sequelize.query(
        `COMMENT ON COLUMN shows.style_prefix IS 'Per-show design language prefix for AI image generation prompts'`
      );
    } catch { /* column may already exist */ }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ui_overlay_types', 'is_home');
    try {
      await queryInterface.removeColumn('shows', 'style_prefix');
    } catch { /* ignore */ }
  },
};
