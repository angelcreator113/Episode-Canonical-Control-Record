'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add property/home-specific fields to world_locations
    await queryInterface.addColumn('world_locations', 'style_guide', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Property style guide — materials, palette, hardware, architecture that cascades to child rooms',
    });

    await queryInterface.addColumn('world_locations', 'floor_plan', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Floor plan data — room connections, doorway links, spatial relationships',
    });

    await queryInterface.addColumn('world_locations', 'property_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: 'Property classification: penthouse, mansion, apartment, townhouse, studio, etc.',
    });

    // Add room connection fields to scene_sets
    await queryInterface.addColumn('scene_sets', 'room_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: 'Room type within a property: bedroom, closet, bathroom, living_room, kitchen, hallway, terrace',
    });

    await queryInterface.addColumn('scene_sets', 'room_connections', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Connections to other rooms: [{ object_id, target_scene_set_id, connection_type: "door"|"archway"|"open" }]',
    });

    await queryInterface.addColumn('scene_sets', 'room_layout_template', {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: null,
      comment: 'Empty room layout template ID used for this room',
    });

    await queryInterface.addColumn('scene_sets', 'empty_room_url', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'URL to the empty room base image (before decoration)',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('world_locations', 'style_guide');
    await queryInterface.removeColumn('world_locations', 'floor_plan');
    await queryInterface.removeColumn('world_locations', 'property_type');
    await queryInterface.removeColumn('scene_sets', 'room_type');
    await queryInterface.removeColumn('scene_sets', 'room_connections');
    await queryInterface.removeColumn('scene_sets', 'room_layout_template');
    await queryInterface.removeColumn('scene_sets', 'empty_room_url');
  },
};
