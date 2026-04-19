'use strict';

/**
 * Migration: add completed_mission_ids to phone_playthrough_state
 *
 * The mission reward system (phoneRuntime evaluateMissions + applyMissionRewards)
 * tracks which missions have already had their reward actions fired for a given
 * playthrough via this column. Without it, rewards would re-fire on every tap
 * after the first completion.
 *
 * The model + routes have been referencing this column since the missions
 * feature shipped; the original create migration for phone_playthrough_state
 * just missed it. This backfills the column on existing rows with [].
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('phone_playthrough_state', 'completed_mission_ids', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: false,
      defaultValue: [],
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('phone_playthrough_state', 'completed_mission_ids');
  },
};
