'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('characters', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'shows', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Associated show',
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Character name',
      },
      role: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Character role (e.g. main, supporting, extra)',
      },
      display_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Optional display name override',
      },
      avatar_asset_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference to avatar asset',
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        comment: 'Additional character metadata',
      },
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

    // Index for fast lookups by show
    await queryInterface.addIndex('characters', ['show_id'], {
      name: 'idx_characters_show_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('characters');
  },
};
