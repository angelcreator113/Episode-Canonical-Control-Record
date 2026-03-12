'use strict';

/**
 * Add a unique composite index on (character_id_a, character_id_b, relationship_type)
 * to prevent duplicate relationships at the database level.
 *
 * Before creating the index, remove any existing duplicates by keeping only the
 * oldest row for each (a, b, type) triple.
 */
module.exports = {
  async up(queryInterface) {
    // Remove duplicates first — keep the earliest created row per (a, b, type)
    await queryInterface.sequelize.query(`
      DELETE FROM character_relationships
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY character_id_a, character_id_b, relationship_type
                   ORDER BY created_at ASC
                 ) AS rn
          FROM character_relationships
        ) dupes
        WHERE rn > 1
      );
    `);

    // Also remove bidirectional duplicates: if (A,B,'sister') and (B,A,'sister') both exist,
    // keep only the one with the smaller character_id_a
    await queryInterface.sequelize.query(`
      DELETE FROM character_relationships
      WHERE id IN (
        SELECT cr2.id
        FROM character_relationships cr1
        JOIN character_relationships cr2
          ON cr1.character_id_a = cr2.character_id_b
         AND cr1.character_id_b = cr2.character_id_a
         AND cr1.relationship_type = cr2.relationship_type
         AND cr1.character_id_a < cr2.character_id_a
      );
    `);

    // Now add the unique index
    await queryInterface.addIndex(
      'character_relationships',
      ['character_id_a', 'character_id_b', 'relationship_type'],
      { name: 'idx_char_rel_unique_pair_type', unique: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('character_relationships', 'idx_char_rel_unique_pair_type');
  },
};
