'use strict';

/**
 * Migration: Add world_location_id to scene_sets
 *
 * Links the production asset (SceneSet) to the narrative concept (WorldLocation).
 * Optional FK — scene sets can exist without a location, locations can exist
 * without a visual representation.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('scene_sets', 'world_location_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'world_locations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'FK to world_locations — narrative source for this visual environment',
    });

    await queryInterface.addIndex('scene_sets', ['world_location_id'], {
      name: 'idx_scene_sets_world_location',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('scene_sets', 'idx_scene_sets_world_location');
    await queryInterface.removeColumn('scene_sets', 'world_location_id');
  },
};
