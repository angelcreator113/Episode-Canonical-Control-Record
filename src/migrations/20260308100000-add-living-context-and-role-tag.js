'use strict';

/**
 * Migration: Add living_context JSONB to registry_characters
 *            Add role_tag to character_relationships
 *
 * living_context stores a character's current life architecture:
 *   active_pressures, support_network, home_environment,
 *   relationship_to_deadlines, financial_reality, current_season
 *
 * role_tag classifies relationship edges for scene brief:
 *   ally, detractor, mentor, dependency, rival, partner, family, etc.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const regCols = await queryInterface.describeTable('registry_characters');
    const relCols = await queryInterface.describeTable('character_relationships');

    if (!regCols.living_context) {
      await queryInterface.addColumn('registry_characters', 'living_context', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!relCols.role_tag) {
      await queryInterface.addColumn('character_relationships', 'role_tag', {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
        comment: 'ally | detractor | mentor | dependency | rival | partner | family | neutral',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('registry_characters', 'living_context');
    await queryInterface.removeColumn('character_relationships', 'role_tag');
  },
};
