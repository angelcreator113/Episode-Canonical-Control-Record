'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Books table
    await queryInterface.createTable('storyteller_books', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'shows', key: 'id' },
        onDelete: 'SET NULL',
      },
      character_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      season_label: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      week_label: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      subtitle: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('draft', 'in_review', 'locked'),
        defaultValue: 'draft',
        allowNull: false,
      },
      compiled_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      },
    });

    // Chapters table
    await queryInterface.createTable('storyteller_chapters', {
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
      chapter_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      badge: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      },
    });

    // Lines table
    await queryInterface.createTable('storyteller_lines', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      chapter_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'storyteller_chapters', key: 'id' },
        onDelete: 'CASCADE',
      },
      group_label: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'e.g. "Arc Summary", "Character Shift Detected", "Relationship Thread"',
      },
      text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'edited', 'rejected'),
        defaultValue: 'pending',
        allowNull: false,
      },
      source_tags: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of source tag strings, e.g. ["voice · feb 14", "goal entry"]',
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      original_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Original text before user edit',
      },
      edited_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      },
    });

    // Indexes
    await queryInterface.addIndex('storyteller_books', ['show_id']);
    await queryInterface.addIndex('storyteller_books', ['character_name']);
    await queryInterface.addIndex('storyteller_chapters', ['book_id', 'sort_order']);
    await queryInterface.addIndex('storyteller_lines', ['chapter_id', 'sort_order']);
    await queryInterface.addIndex('storyteller_lines', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('storyteller_lines');
    await queryInterface.dropTable('storyteller_chapters');
    await queryInterface.dropTable('storyteller_books');
  },
};
