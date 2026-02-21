'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('universes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'e.g. lalaverse',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Top-level philosophy. What is this world about?',
      },
      core_themes: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of theme strings e.g. ["identity","ambition","becoming"]',
      },
      world_rules: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Cause & effect, consequence echoes, universe laws',
      },
      pnos_beliefs: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'PNOS belief system — the psychological operating system',
      },
      narrative_economy: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Prime Coins, Dream Fund, reputation mechanics',
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

    await queryInterface.addIndex('universes', ['slug'], {
      unique: true,
      name: 'universes_slug_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('universes');
  },
};
