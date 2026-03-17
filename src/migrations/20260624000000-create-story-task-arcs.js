'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('story_task_arcs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      character_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      display_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      world: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      narrative_spine: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      tasks: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('story_task_arcs');
  },
};
