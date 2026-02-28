'use strict';

/**
 * Migration: 20260227000001-add-soft-delete-to-storyteller-tables.js
 *
 * Adds deleted_at TIMESTAMPTZ to:
 *   storyteller_books, storyteller_chapters, storyteller_lines,
 *   registry_characters, continuity_beats
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = [
      'storyteller_books',
      'storyteller_chapters',
      'storyteller_lines',
      'registry_characters',
      'continuity_beats',
    ];

    for (const table of tables) {
      // Check if column already exists before adding
      const desc = await queryInterface.describeTable(table).catch(() => ({}));
      if (!desc.deleted_at) {
        await queryInterface.addColumn(table, 'deleted_at', {
          type:         Sequelize.DATE,
          allowNull:    true,
          defaultValue: null,
        });
      }

      // Partial index for fast filtering — only indexes NULL rows
      await queryInterface.addIndex(table, ['deleted_at'], {
        name: `${table}_deleted_at_idx`,
        where: { deleted_at: null },
      }).catch(() => {}); // ignore if already exists
    }
  },

  async down(queryInterface) {
    const tables = [
      'storyteller_books',
      'storyteller_chapters',
      'storyteller_lines',
      'registry_characters',
      'continuity_beats',
    ];

    for (const table of tables) {
      await queryInterface.removeIndex(table, `${table}_deleted_at_idx`).catch(() => {});
      await queryInterface.removeColumn(table, 'deleted_at').catch(() => {});
    }
  },
};
