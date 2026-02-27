'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('storyteller_chapters');
    if (!tableDesc.draft_prose) {
      await queryInterface.addColumn('storyteller_chapters', 'draft_prose', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('storyteller_chapters', 'draft_prose');
  },
};
