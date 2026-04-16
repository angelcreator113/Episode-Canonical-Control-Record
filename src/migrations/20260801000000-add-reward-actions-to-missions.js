'use strict';

/**
 * Migration: add reward_actions to phone_missions.
 *
 * Rewards fire once per playthrough on the transition from incomplete → complete.
 * The playthrough row's existing completed_mission_ids array tracks which
 * missions have already fired rewards, so we never double-trigger.
 *
 * Same action grammar + allowlist zones use — validated by
 * phoneConditionSchema.actionsArraySchema.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('phone_missions', 'reward_actions', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('phone_missions', 'reward_actions');
  },
};
