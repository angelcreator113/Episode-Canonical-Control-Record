'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Make legacy columns nullable
    const legacyColumns = ['upload_date', 'last_modified'];
    
    for (const column of legacyColumns) {
      await queryInterface.changeColumn('episodes', column, {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('episodes', 'upload_date', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    });
    
    await queryInterface.changeColumn('episodes', 'last_modified', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    });
  },
};
