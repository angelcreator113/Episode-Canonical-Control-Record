'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('episodes');
    
    if (!table.current_ai_edit_plan_id) {
      await queryInterface.addColumn('episodes', 'current_ai_edit_plan_id', {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference to the current AI edit plan for this episode',
      });
    }
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeColumn('episodes', 'current_ai_edit_plan_id');
  },
};
