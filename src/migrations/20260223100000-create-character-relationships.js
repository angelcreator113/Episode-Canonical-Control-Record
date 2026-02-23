'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('character_relationships', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      book_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      layer: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'real_world',
        comment: 'real_world | lalaverse',
      },
      source_name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      target_name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      relationship_type: {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: 'knows',
      },
      direction: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'both',
        comment: 'both | source_to_target | target_to_source',
      },
      label: {
        type: Sequelize.STRING(60),
        allowNull: true,
      },
      subtext: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      source_knows: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      target_knows: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reader_knows: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        comment: 'active | dormant | broken | secret',
      },
      appears_in: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of chapter slugs / scene ids',
      },
      intensity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
        comment: '1-5 emotional weight',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      source_x: { type: Sequelize.FLOAT, defaultValue: 0 },
      source_y: { type: Sequelize.FLOAT, defaultValue: 0 },
      target_x: { type: Sequelize.FLOAT, defaultValue: 0 },
      target_y: { type: Sequelize.FLOAT, defaultValue: 0 },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Indexes
    await queryInterface.addIndex('character_relationships', ['show_id']);
    await queryInterface.addIndex('character_relationships', ['book_id']);
    await queryInterface.addIndex('character_relationships', ['layer']);
    await queryInterface.addIndex('character_relationships', ['source_name']);
    await queryInterface.addIndex('character_relationships', ['target_name']);
    await queryInterface.addIndex('character_relationships', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('character_relationships');
  },
};
