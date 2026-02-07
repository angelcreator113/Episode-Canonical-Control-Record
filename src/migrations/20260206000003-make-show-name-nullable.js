'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Make show_name and season_number nullable since we now use show_id relationship
    await queryInterface.changeColumn('episodes', 'show_name', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    
    await queryInterface.changeColumn('episodes', 'season_number', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('episodes', 'show_name', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
    
    await queryInterface.changeColumn('episodes', 'season_number', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
