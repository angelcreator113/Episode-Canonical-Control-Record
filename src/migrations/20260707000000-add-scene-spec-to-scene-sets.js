'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('scene_sets', 'scene_spec', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'SceneSpec — room layout, zones, objects with continuity rules, camera contracts, and room states',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('scene_sets', 'scene_spec');
  },
};
