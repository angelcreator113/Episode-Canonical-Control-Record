'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const tableDescription = await queryInterface.describeTable('episodes');
      if (!tableDescription.categories) {
        await queryInterface.addColumn('episodes', 'categories', {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: [],
          comment: 'Array of category/tag strings for the episode',
        });
        console.log('✅ Added categories column to episodes table');
      }
    } catch (error) {
      console.error('Error adding categories column:', error);
      throw error;
    }
  },

  down: async (queryInterface, _Sequelize) => {
    try {
      const tableDescription = await queryInterface.describeTable('episodes');
      if (tableDescription.categories) {
        await queryInterface.removeColumn('episodes', 'categories');
        console.log('✅ Removed categories column from episodes table');
      }
    } catch (error) {
      console.error('Error removing categories column:', error);
      throw error;
    }
  },
};
