'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('scene_angles', 'angle_description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('scene_angles', 'camera_direction', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('scene_angles', 'camera_direction');
    await queryInterface.removeColumn('scene_angles', 'angle_description');
  },
};
