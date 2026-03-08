'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const regCols = await queryInterface.describeTable('registry_characters');
    const relCols = await queryInterface.describeTable('character_relationships');

    if (!regCols.hidden_want) {
      await queryInterface.addColumn('registry_characters', 'hidden_want', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!relCols.source_knows) {
      await queryInterface.addColumn('character_relationships', 'source_knows', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!relCols.target_knows) {
      await queryInterface.addColumn('character_relationships', 'target_knows', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!relCols.reader_knows) {
      await queryInterface.addColumn('character_relationships', 'reader_knows', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('registry_characters', 'hidden_want');
    await queryInterface.removeColumn('character_relationships', 'source_knows');
    await queryInterface.removeColumn('character_relationships', 'target_knows');
    await queryInterface.removeColumn('character_relationships', 'reader_knows');
  },
};
