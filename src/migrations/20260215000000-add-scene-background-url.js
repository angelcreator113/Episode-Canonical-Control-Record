'use strict';

/**
 * Migration: Add background_url column to scenes table
 * 
 * The Scene Composer saves per-scene background URLs but the column
 * was missing from both the model and the database.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('scenes');

    if (!table.background_url) {
      await queryInterface.addColumn('scenes', 'background_url', {
        type: Sequelize.STRING(1000),
        allowNull: true,
        comment: 'URL of the background image/video for scene composition',
      });
      console.log('✅ Added background_url column to scenes table');
    } else {
      console.log('ℹ️  background_url column already exists');
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('scenes', 'background_url');
  },
};
