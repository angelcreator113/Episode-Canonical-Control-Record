'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('scene_plans');
    if (!desc.feed_moment) {
      await queryInterface.addColumn('scene_plans', 'feed_moment', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }
    if (!desc.script_lines) {
      await queryInterface.addColumn('scene_plans', 'script_lines', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    try { await queryInterface.removeColumn('scene_plans', 'feed_moment'); } catch {}
    try { await queryInterface.removeColumn('scene_plans', 'script_lines'); } catch {}
  },
};
