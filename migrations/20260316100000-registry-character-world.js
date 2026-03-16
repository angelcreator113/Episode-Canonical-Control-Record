'use strict';

/**
 * Migration: Add `world` ENUM column to registry_characters
 * Drives layer assignment, Feed pipeline, and story engine grouping.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('registry_characters', 'world', {
      type: Sequelize.ENUM('book-1', 'lalaverse', 'series-2'),
      allowNull: true,
      comment: 'Which world this character belongs to. Drives layer assignment, Feed pipeline, story engine grouping.',
    });

    // Backfill existing characters based on whatever data we have
    // Characters with universe = 'lalaverse' or layer = 'lalaverse' → lalaverse
    // Everything else → book-1 (safe default for existing PNOS characters)
    await queryInterface.sequelize.query(`
      UPDATE registry_characters
      SET world = CASE
        WHEN universe = 'lalaverse' OR layer = 'lalaverse' THEN 'lalaverse'::"enum_registry_characters_world"
        WHEN universe = 'series-2'  OR layer = 'series-2'  THEN 'series-2'::"enum_registry_characters_world"
        ELSE 'book-1'::"enum_registry_characters_world"
      END
      WHERE world IS NULL;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('registry_characters', 'world');
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_registry_characters_world";`
    );
  },
};
