'use strict';

/**
 * Add cross-link columns between world_characters and registry_characters
 * so World Studio characters auto-sync to the canonical registry.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add registry_character_id to world_characters
    await queryInterface.addColumn('world_characters', 'registry_character_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'registry_characters', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Add world_character_id to registry_characters
    await queryInterface.addColumn('registry_characters', 'world_character_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    // Index for efficient lookups
    await queryInterface.addIndex('world_characters', ['registry_character_id'], {
      name: 'idx_wc_registry_char',
    });
    await queryInterface.addIndex('registry_characters', ['world_character_id'], {
      name: 'idx_rc_world_char',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('registry_characters', 'idx_rc_world_char');
    await queryInterface.removeIndex('world_characters', 'idx_wc_registry_char');
    await queryInterface.removeColumn('registry_characters', 'world_character_id');
    await queryInterface.removeColumn('world_characters', 'registry_character_id');
  },
};
