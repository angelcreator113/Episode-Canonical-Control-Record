'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('world_characters');
    if (!cols.world_tag) {
      await queryInterface.addColumn('world_characters', 'world_tag', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('world_characters', 'world_tag').catch(() => {});
  },
};
