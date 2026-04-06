'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('scene_sets', 'time_of_day', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null,
      comment: 'Default time of day for generation: morning, afternoon, golden_hour, evening, night',
    });
    await queryInterface.addColumn('scene_sets', 'season', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null,
      comment: 'Default season for generation: spring, summer, fall, winter',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('scene_sets', 'time_of_day');
    await queryInterface.removeColumn('scene_sets', 'season');
  },
};
