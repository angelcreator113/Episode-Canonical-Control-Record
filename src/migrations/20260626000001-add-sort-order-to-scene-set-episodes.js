'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('scene_set_episodes').catch(() => null);
    if (!tableDesc) {
      console.log('scene_set_episodes table does not exist — skipping migration');
      return;
    }
    if (tableDesc.sort_order) {
      console.log('sort_order column already exists — skipping');
      return;
    }
    await queryInterface.addColumn('scene_set_episodes', 'sort_order', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('scene_set_episodes').catch(() => null);
    if (tableDesc && tableDesc.sort_order) {
      await queryInterface.removeColumn('scene_set_episodes', 'sort_order');
    }
  },
};
