'use strict';

/**
 * Fix: Make episode_id nullable in character_state_history
 * 
 * Manual stat edits from World Admin don't have an episode_id,
 * so the column must allow NULL.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('character_state_history', 'episode_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('character_state_history', 'episode_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },
};
