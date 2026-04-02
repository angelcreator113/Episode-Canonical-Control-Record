'use strict';

/** Add scene_set_id to world_events for linking events to locations. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('world_events', 'scene_set_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'scene_sets', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('world_events', ['scene_set_id'], {
      name: 'idx_world_events_scene_set_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('world_events', 'scene_set_id');
  },
};
