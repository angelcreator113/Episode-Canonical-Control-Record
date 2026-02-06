'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('scenes', 'thumbnail_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'thumbnails',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('scenes', 'assets', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Asset references: {lala_outfit_id, guest_asset_id, background_id, ui_elements[]}',
    });

    // Add index for thumbnail lookups
    await queryInterface.addIndex('scenes', ['thumbnail_id'], {
      name: 'idx_scenes_thumbnail_id',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('scenes', 'idx_scenes_thumbnail_id');
    await queryInterface.removeColumn('scenes', 'assets');
    await queryInterface.removeColumn('scenes', 'thumbnail_id');
  },
};
