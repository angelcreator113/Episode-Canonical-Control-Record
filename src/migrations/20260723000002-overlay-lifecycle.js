'use strict';

/**
 * Add overlay lifecycle tracking — permanent vs per_episode vs variant.
 * Adds lifecycle field to ui_overlay_types and episode_id to assets
 * for per-episode overlay assets.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add lifecycle to custom overlay types table
    await queryInterface.addColumn('ui_overlay_types', 'lifecycle', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'permanent',
      comment: 'permanent — generated once, reused forever | per_episode — new version each episode | variant — base frame permanent, content changes',
    });

    // Add episode_id to assets so per-episode overlays link to their episode
    // Using raw SQL because the column may already exist on some deployments
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS episode_id UUID REFERENCES episodes(id)`
      );
    } catch { /* column may already exist */ }

    // Add overlay_lifecycle to assets metadata tracking
    await queryInterface.addIndex('assets', ['asset_type', 'show_id', 'episode_id'], {
      name: 'idx_assets_overlay_episode',
      where: { asset_type: 'UI_OVERLAY', deleted_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ui_overlay_types', 'lifecycle');
    try {
      await queryInterface.removeIndex('assets', 'idx_assets_overlay_episode');
    } catch { /* ignore */ }
  },
};
