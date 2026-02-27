'use strict';

/**
 * Migration: Add registrySync fields to registry_characters
 *
 * Adds columns needed by src/services/registrySync.js:
 *   - wound_depth      (FLOAT, 0-10 scale)
 *   - belief_pressured (TEXT)
 *   - emotional_function (TEXT)
 *   - writer_notes     (TEXT)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('registry_characters');

    if (!tableDesc.wound_depth) {
      await queryInterface.addColumn('registry_characters', 'wound_depth', {
        type:         Sequelize.FLOAT,
        defaultValue: 0,
        allowNull:    true,
        comment:      '0-10 scale. Increments with pain points and therapy activations.',
      });
    }

    if (!tableDesc.belief_pressured) {
      await queryInterface.addColumn('registry_characters', 'belief_pressured', {
        type:      Sequelize.TEXT,
        allowNull: true,
        comment:   'The belief this character puts pressure on in the protagonist.',
      });
    }

    if (!tableDesc.emotional_function) {
      await queryInterface.addColumn('registry_characters', 'emotional_function', {
        type:      Sequelize.TEXT,
        allowNull: true,
        comment:   'Running emotional state log. Updated by therapy sessions.',
      });
    }

    if (!tableDesc.writer_notes) {
      await queryInterface.addColumn('registry_characters', 'writer_notes', {
        type:      Sequelize.TEXT,
        allowNull: true,
        comment:   'Timestamped notes from therapy, memory, story, and pain point events.',
      });
    }
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('registry_characters');

    if (tableDesc.writer_notes)       await queryInterface.removeColumn('registry_characters', 'writer_notes');
    if (tableDesc.emotional_function) await queryInterface.removeColumn('registry_characters', 'emotional_function');
    if (tableDesc.belief_pressured)   await queryInterface.removeColumn('registry_characters', 'belief_pressured');
    if (tableDesc.wound_depth)        await queryInterface.removeColumn('registry_characters', 'wound_depth');
  },
};
