'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add hidden_want to registry_characters (top-level, alongside wound/desire/belief)
    await queryInterface.addColumn('registry_characters', 'hidden_want', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // 2. Add knowledge asymmetry columns to character_relationships
    await queryInterface.addColumn('character_relationships', 'source_knows', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('character_relationships', 'target_knows', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('character_relationships', 'reader_knows', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('registry_characters', 'hidden_want');
    await queryInterface.removeColumn('character_relationships', 'source_knows');
    await queryInterface.removeColumn('character_relationships', 'target_knows');
    await queryInterface.removeColumn('character_relationships', 'reader_knows');
  },
};
