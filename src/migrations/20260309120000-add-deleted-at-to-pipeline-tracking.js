'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('pipeline_tracking');
    if (!table.deleted_at) {
      await queryInterface.addColumn('pipeline_tracking', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pipeline_tracking', 'deleted_at');
  },
};
