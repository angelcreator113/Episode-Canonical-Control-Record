'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('press_careers', {
      id:                 { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      character_slug:     { type: Sequelize.STRING, allowNull: false, unique: true },
      current_stage:      { type: Sequelize.INTEGER, defaultValue: 1 },
      stage_history:      { type: Sequelize.JSONB, defaultValue: [] },
      sessions_completed: { type: Sequelize.INTEGER, defaultValue: 0 },
      content_generated:  { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at:         { type: Sequelize.DATE, allowNull: false },
      updated_at:         { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('press_careers');
  },
};
