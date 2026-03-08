'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('registry_characters');
    if (!table.deep_profile) {
      await queryInterface.addColumn('registry_characters', 'deep_profile', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('registry_characters', 'deep_profile');
  },
};
