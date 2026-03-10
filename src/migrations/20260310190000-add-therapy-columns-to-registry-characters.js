'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'registry_characters';

    // Check which columns already exist to avoid errors
    const desc = await queryInterface.describeTable(table);

    if (!desc.therapy_primary_defense) {
      await queryInterface.addColumn(table, 'therapy_primary_defense', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!desc.therapy_emotional_state) {
      await queryInterface.addColumn(table, 'therapy_emotional_state', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }

    if (!desc.therapy_baseline) {
      await queryInterface.addColumn(table, 'therapy_baseline', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = 'registry_characters';
    await queryInterface.removeColumn(table, 'therapy_primary_defense');
    await queryInterface.removeColumn(table, 'therapy_emotional_state');
    await queryInterface.removeColumn(table, 'therapy_baseline');
  },
};
