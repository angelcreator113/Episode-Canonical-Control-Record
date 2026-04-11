'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('show_arcs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      show_id: { type: Sequelize.UUID, allowNull: false },
      arc_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      title: { type: Sequelize.STRING(200), allowNull: false },
      tagline: { type: Sequelize.STRING(300), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      season_number: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 1 },
      episode_start: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      episode_end: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 24 },
      phases: { type: Sequelize.JSONB, allowNull: false, defaultValue: '[]' },
      current_phase: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      current_episode: { type: Sequelize.INTEGER, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'active' },
      narrative_debt: { type: Sequelize.JSONB, allowNull: false, defaultValue: '[]' },
      progression_log: { type: Sequelize.JSONB, allowNull: false, defaultValue: '[]' },
      emotional_temperature: { type: Sequelize.STRING(30), allowNull: true },
      icon: { type: Sequelize.STRING(10), allowNull: true, defaultValue: '📖' },
      color: { type: Sequelize.STRING(20), allowNull: true, defaultValue: '#B8962E' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('show_arcs', ['show_id', 'arc_number'], { unique: true });
    await queryInterface.addIndex('show_arcs', ['show_id', 'status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('show_arcs');
  },
};
