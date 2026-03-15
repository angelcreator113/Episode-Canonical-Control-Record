'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('world_characters');
    if (!cols.gender) {
      await queryInterface.addColumn('world_characters', 'gender', {
        type: Sequelize.STRING(50),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('world_characters', 'gender').catch(() => {});
  },
};
