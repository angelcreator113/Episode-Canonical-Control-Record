'use strict';

/**
 * Add expanded character profile columns to world_characters.
 * These columns were referenced in the generate-ecosystem routes but never migrated.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('world_characters');

    const additions = [
      ['sexuality',             Sequelize.STRING(100)],
      ['attracted_to',          Sequelize.TEXT],
      ['how_they_love',         Sequelize.TEXT],
      ['desire_they_wont_admit', Sequelize.TEXT],
      ['relationship_graph',    Sequelize.JSONB],
      ['family_layer',          Sequelize.TEXT],
      ['origin_story',          Sequelize.TEXT],
      ['public_persona',        Sequelize.TEXT],
      ['private_reality',       Sequelize.TEXT],
      ['relationship_status',   Sequelize.STRING(100)],
      ['committed_to',          Sequelize.STRING(255)],
      ['moral_code',            Sequelize.TEXT],
      ['fidelity_pattern',      Sequelize.TEXT],
    ];

    for (const [name, type] of additions) {
      if (!cols[name]) {
        await queryInterface.addColumn('world_characters', name, {
          type,
          allowNull: true,
        });
      }
    }
  },

  async down(queryInterface) {
    const cols = [
      'sexuality', 'attracted_to', 'how_they_love', 'desire_they_wont_admit',
      'relationship_graph', 'family_layer', 'origin_story',
      'public_persona', 'private_reality', 'relationship_status',
      'committed_to', 'moral_code', 'fidelity_pattern',
    ];
    for (const name of cols) {
      await queryInterface.removeColumn('world_characters', name).catch(() => {});
    }
  },
};
