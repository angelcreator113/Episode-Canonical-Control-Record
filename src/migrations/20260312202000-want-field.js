'use strict';

/** Migration: 20260312202000-want-field
 *
 * Adds Want Field columns to character_entanglements.
 * Every entanglement carries the desire underneath the connection.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('character_entanglements');

    if (!desc.what_they_want) {
      await queryInterface.addColumn('character_entanglements', 'what_they_want', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Freeform; author-written or Amber-proposed',
    });
    }
    if (!desc.want_category) {
      await queryInterface.addColumn('character_entanglements', 'want_category', {
        type: Sequelize.ENUM(
          'to_become', 'to_have', 'to_destroy', 'to_be_seen_by',
          'to_escape', 'to_protect', 'to_understand'
        ),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('character_entanglements', 'want_category');
    await queryInterface.removeColumn('character_entanglements', 'what_they_want');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_character_entanglements_want_category";');
  },
};
