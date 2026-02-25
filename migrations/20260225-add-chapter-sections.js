'use strict';

/**
 * Migration: Add sections JSONB + chapter_template to storyteller_chapters
 *
 * sections stores structured content blocks:
 * [
 *   { id: 'uuid', type: 'h2', content: 'Chapter Title', collapsed: false },
 *   { id: 'uuid', type: 'h3', content: 'Section Header', collapsed: false },
 *   { id: 'uuid', type: 'body', content: 'Paragraph text...', collapsed: false },
 *   { id: 'uuid', type: 'quote', content: 'A reflection...', collapsed: false },
 *   { id: 'uuid', type: 'divider', content: '', collapsed: false },
 * ]
 *
 * Valid types: h1, h2, h3, h4, body, quote, divider, reflection
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('storyteller_chapters', 'sections', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('storyteller_chapters', 'chapter_template', {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: null,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('storyteller_chapters', 'sections');
    await queryInterface.removeColumn('storyteller_chapters', 'chapter_template');
  },
};
