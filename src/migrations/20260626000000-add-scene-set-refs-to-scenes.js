'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const scenesDesc = await queryInterface.describeTable('scenes').catch(() => null);
    if (!scenesDesc) return;
    if (scenesDesc.scene_set_id) {
      console.log('scene_set_id already exists on scenes — skipping');
      return;
    }
    const setsExist = await queryInterface.describeTable('scene_sets').catch(() => null);
    const anglesExist = await queryInterface.describeTable('scene_angles').catch(() => null);

    await queryInterface.addColumn('scenes', 'scene_set_id', {
      type: Sequelize.UUID,
      allowNull: true,
      ...(setsExist ? {
        references: { model: 'scene_sets', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      } : {}),
    });

    await queryInterface.addColumn('scenes', 'scene_angle_id', {
      type: Sequelize.UUID,
      allowNull: true,
      ...(anglesExist ? {
        references: { model: 'scene_angles', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      } : {}),
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
