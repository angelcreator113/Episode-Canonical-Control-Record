'use strict';

/** ─────────────────────────────────────────────────────────────────────────────
 * Migration: Add Ensemble World Fields to character_relationships
 *
 * Moves the model from Lala-hub to true ensemble world.
 *
 * Adds:
 *   family_role          — mother | father | sister | brother | aunt | uncle |
 *                          cousin | grandmother | grandfather | daughter | son |
 *                          niece | nephew | stepmother | stepsister | etc.
 *   is_blood_relation    — boolean: differentiates family from found-family
 *   is_romantic          — boolean: explicit flag for romantic connections
 *                          (supplements relationship_type, enables fast filtering)
 *   conflict_summary     — text: the conflict between A and B, independent of Lala
 *   knows_about_connection — boolean: does character B know about character A's
 *                            connection to Lala / JustAWoman? Tracks asymmetric
 *                            awareness across the franchise secret.
 * ───────────────────────────────────────────────────────────────────────────── */

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'character_relationships';

    await queryInterface.addColumn(table, 'family_role', {
      type:         Sequelize.STRING(120),
      allowNull:    true,
      defaultValue: null,
      comment:      'mother | father | sister | brother | aunt | uncle | cousin | grandmother | etc.',
    });

    await queryInterface.addColumn(table, 'is_blood_relation', {
      type:         Sequelize.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
      comment:      'true = biological family. false = found family, step, or chosen.',
    });

    await queryInterface.addColumn(table, 'is_romantic', {
      type:         Sequelize.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
      comment:      'Explicit romantic flag — enables filtering independent of relationship_type label.',
    });

    await queryInterface.addColumn(table, 'conflict_summary', {
      type:         Sequelize.TEXT,
      allowNull:    true,
      defaultValue: null,
      comment:      'The conflict between character A and character B — independent of Lala.',
    });

    await queryInterface.addColumn(table, 'knows_about_connection', {
      type:         Sequelize.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
      comment:      'Does character B know about character A\'s connection to Lala / JustAWoman?',
    });
  },

  async down(queryInterface) {
    const table = 'character_relationships';
    for (const col of [
      'family_role', 'is_blood_relation', 'is_romantic',
      'conflict_summary', 'knows_about_connection',
    ]) {
      await queryInterface.removeColumn(table, col);
    }
  },
};
