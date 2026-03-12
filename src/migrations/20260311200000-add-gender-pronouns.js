'use strict';

/**
 * Add gender + pronouns columns to registry_characters.
 * Idempotent — safe to re-run.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = 'registry_characters';
    const desc = await queryInterface.describeTable(table);

    if (!desc.gender) {
      await queryInterface.addColumn(table, 'gender', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!desc.pronouns) {
      await queryInterface.addColumn(table, 'pronouns', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = 'registry_characters';
    const desc = await queryInterface.describeTable(table);
    if (desc.pronouns) await queryInterface.removeColumn(table, 'pronouns');
    if (desc.gender) await queryInterface.removeColumn(table, 'gender');
  },
};
