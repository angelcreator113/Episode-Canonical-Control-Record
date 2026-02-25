'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('registry_characters');
    if (!tableInfo.portrait_url) {
      await queryInterface.addColumn('registry_characters', 'portrait_url', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('registry_characters', 'portrait_url');
  },
};
