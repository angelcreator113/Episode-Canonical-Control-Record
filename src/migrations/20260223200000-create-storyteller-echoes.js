'use strict';

/**
 * Migration: create storyteller_echoes table
 *
 * An echo is a moment planted in one chapter that reverberates in a later
 * chapter. It tracks the source line, target chapter, narrative note,
 * and whether it has landed.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('storyteller_echoes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      book_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'storyteller_books', key: 'id' },
        onDelete: 'CASCADE',
      },
      source_chapter_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'storyteller_chapters', key: 'id' },
        onDelete: 'SET NULL',
      },
      source_line_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      source_line_content: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Snapshot of line at time of planting',
      },
      target_chapter_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'storyteller_chapters', key: 'id' },
        onDelete: 'SET NULL',
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'What this plants — narrative seed description',
      },
      landing_note: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'How it should feel when it lands',
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'planted',
        comment: 'planted | landed | orphaned',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Soft delete (global paranoid: true)',
      },
    });

    await queryInterface.addIndex('storyteller_echoes', ['book_id']);
    await queryInterface.addIndex('storyteller_echoes', ['target_chapter_id']);
    await queryInterface.addIndex('storyteller_echoes', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('storyteller_echoes');
  },
};
