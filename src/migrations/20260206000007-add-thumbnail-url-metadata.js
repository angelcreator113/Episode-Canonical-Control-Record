'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('thumbnails');
    
    // Add url column - computed/cached URL for thumbnail
    if (!table.url) {
      await queryInterface.addColumn('thumbnails', 'url', {
        type: Sequelize.STRING(1024),
        allowNull: true,
      });
    }
    
    // Add metadata column - additional JSON metadata
    if (!table.metadata) {
      await queryInterface.addColumn('thumbnails', 'metadata', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('thumbnails', 'url');
    await queryInterface.removeColumn('thumbnails', 'metadata');
  },
};
