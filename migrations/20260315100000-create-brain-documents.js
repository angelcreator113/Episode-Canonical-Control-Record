'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('brain_documents', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      source_name: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      document_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      entries_created: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      ingested_by: {
        type: Sequelize.STRING(100),
        defaultValue: 'manual',
      },
      ingested_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('brain_documents');
  },
};
