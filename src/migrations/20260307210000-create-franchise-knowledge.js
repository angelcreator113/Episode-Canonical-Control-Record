'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('franchise_knowledge', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: Sequelize.STRING(200), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      category: {
        type: Sequelize.ENUM(
          'character', 'narrative', 'locked_decision',
          'franchise_law', 'technical', 'brand', 'world'
        ),
        defaultValue: 'narrative',
      },
      severity: {
        type: Sequelize.ENUM('critical', 'important', 'context'),
        defaultValue: 'important',
      },
      applies_to: {
        type: Sequelize.JSONB,
        defaultValue: [],
      },
      always_inject: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      source_document: { type: Sequelize.STRING(200), allowNull: true },
      source_version: { type: Sequelize.STRING(20), allowNull: true },
      extracted_by: {
        type: Sequelize.ENUM(
          'document_ingestion', 'conversation_extraction', 'direct_entry', 'system'
        ),
        defaultValue: 'direct_entry',
      },
      status: {
        type: Sequelize.ENUM('pending_review', 'active', 'superseded', 'archived'),
        defaultValue: 'pending_review',
      },
      superseded_by: { type: Sequelize.INTEGER, allowNull: true },
      review_note: { type: Sequelize.TEXT, allowNull: true },
      injection_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      last_injected_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // Index on status + severity for fast injection queries
    await queryInterface.addIndex('franchise_knowledge', ['status', 'severity'], {
      name: 'idx_fk_status_severity',
    });

    // Index on always_inject for the hot path
    await queryInterface.addIndex('franchise_knowledge', ['always_inject'], {
      name: 'idx_fk_always_inject',
      where: { always_inject: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('franchise_knowledge');
  },
};
