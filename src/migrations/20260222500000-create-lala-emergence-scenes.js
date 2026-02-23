'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lala_emergence_scenes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      line_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'storyteller_lines', key: 'id' },
        onDelete: 'CASCADE',
      },
      chapter_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'storyteller_chapters', key: 'id' },
        onDelete: 'CASCADE',
      },
      book_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'storyteller_books', key: 'id' },
        onDelete: 'CASCADE',
      },
      line_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      line_content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      chapter_title: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      emotional_context: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      scene_type: {
        type: Sequelize.STRING(50),
        defaultValue: 'lala_emergence',
        allowNull: false,
      },
      confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      canon_tier: {
        type: Sequelize.STRING(20),
        defaultValue: 'proto',
        allowNull: false,
      },
      detection_method: {
        type: Sequelize.STRING(20),
        defaultValue: 'auto',
        allowNull: false,
      },
      franchise_anchor: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('lala_emergence_scenes', ['book_id']);
    await queryInterface.addIndex('lala_emergence_scenes', ['chapter_id']);
    await queryInterface.addIndex('lala_emergence_scenes', ['line_id'], { unique: true });
    await queryInterface.addIndex('lala_emergence_scenes', ['confirmed']);
    await queryInterface.addIndex('lala_emergence_scenes', ['franchise_anchor']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lala_emergence_scenes');
  },
};
