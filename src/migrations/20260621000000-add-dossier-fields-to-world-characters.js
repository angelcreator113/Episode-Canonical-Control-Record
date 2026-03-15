'use strict';

/** Add dossier-aligned fields to world_characters for richer ecosystem→registry sync */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = [
      // Essence
      ['core_fear',              Sequelize.TEXT],
      ['character_archetype',    Sequelize.STRING(100)],
      ['emotional_baseline',     Sequelize.STRING(100)],
      ['at_their_best',          Sequelize.TEXT],
      ['at_their_worst',         Sequelize.TEXT],
      // Aesthetic DNA
      ['color_palette',          Sequelize.STRING(255)],
      ['signature_silhouette',   Sequelize.TEXT],
      ['signature_accessories',  Sequelize.TEXT],
      ['glam_energy',            Sequelize.STRING(50)],
      // Voice
      ['speech_pattern',         Sequelize.TEXT],
      ['vocabulary_tone',        Sequelize.TEXT],
      ['catchphrases',           Sequelize.TEXT],
      ['internal_monologue_style', Sequelize.TEXT],
      // Career
      ['career_goal',            Sequelize.TEXT],
    ];

    for (const [name, type] of columns) {
      const exists = await queryInterface.sequelize.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'world_characters' AND column_name = '${name}'`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      if (!exists.length) {
        await queryInterface.addColumn('world_characters', name, { type, allowNull: true });
      }
    }
  },

  async down(queryInterface) {
    const columns = [
      'core_fear', 'character_archetype', 'emotional_baseline', 'at_their_best', 'at_their_worst',
      'color_palette', 'signature_silhouette', 'signature_accessories', 'glam_energy',
      'speech_pattern', 'vocabulary_tone', 'catchphrases', 'internal_monologue_style',
      'career_goal',
    ];
    for (const name of columns) {
      await queryInterface.removeColumn('world_characters', name).catch(() => {});
    }
  },
};
