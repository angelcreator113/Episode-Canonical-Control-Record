'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('storyteller_books', 'canon_status', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: 'draft',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('storyteller_books', 'canon_status');
  },
};
