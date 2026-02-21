'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // New literary-first columns for storyteller_books
    await queryInterface.addColumn('storyteller_books', 'primary_pov', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'First Person / Close Third / Multi',
    });

    await queryInterface.addColumn('storyteller_books', 'timeline_position', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Pre-Show / Early Show / Prime Era / Legacy',
    });

    await queryInterface.addColumn('storyteller_books', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Book description / synopsis',
    });

    // Make character_name nullable — title is now the primary field
    await queryInterface.changeColumn('storyteller_books', 'character_name', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('storyteller_books', 'primary_pov');
    await queryInterface.removeColumn('storyteller_books', 'timeline_position');
    await queryInterface.removeColumn('storyteller_books', 'description');

    await queryInterface.changeColumn('storyteller_books', 'character_name', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
  },
};
