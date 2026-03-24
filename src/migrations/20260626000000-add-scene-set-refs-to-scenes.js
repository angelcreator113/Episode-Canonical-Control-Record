'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('scenes', 'scene_set_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'scene_sets', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addColumn('scenes', 'scene_angle_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'scene_angles', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addIndex('scenes', ['scene_set_id'], {
      name: 'idx_scenes_scene_set_id',
    });

    await queryInterface.addIndex('scenes', ['scene_angle_id'], {
      name: 'idx_scenes_scene_angle_id',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('scenes', 'idx_scenes_scene_angle_id');
    await queryInterface.removeIndex('scenes', 'idx_scenes_scene_set_id');
    await queryInterface.removeColumn('scenes', 'scene_angle_id');
    await queryInterface.removeColumn('scenes', 'scene_set_id');
  },
};
