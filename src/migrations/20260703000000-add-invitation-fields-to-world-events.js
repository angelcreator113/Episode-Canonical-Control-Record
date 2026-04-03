'use strict';

/**
 * Migration: Add invitation style fields to world_events
 *
 * These fields feed the invitation generator directly.
 * Each event can have its own visual personality.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('world_events', 'theme', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'e.g. "honey luxe", "avant-garde", "soft glam", "romantic garden"',
    });

    await queryInterface.addColumn('world_events', 'color_palette', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'e.g. ["blush", "champagne", "honey gold"]',
    });

    await queryInterface.addColumn('world_events', 'mood', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'e.g. "intimate", "aspirational", "electric", "mysterious"',
    });

    await queryInterface.addColumn('world_events', 'floral_style', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'roses / peonies / tropical / minimal / none',
    });

    await queryInterface.addColumn('world_events', 'border_style', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'gold_foil / ornate / minimal / none',
    });

    await queryInterface.addColumn('world_events', 'invitation_asset_id', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'FK to assets table — the generated invitation image',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('world_events', 'theme');
    await queryInterface.removeColumn('world_events', 'color_palette');
    await queryInterface.removeColumn('world_events', 'mood');
    await queryInterface.removeColumn('world_events', 'floral_style');
    await queryInterface.removeColumn('world_events', 'border_style');
    await queryInterface.removeColumn('world_events', 'invitation_asset_id');
  },
};
