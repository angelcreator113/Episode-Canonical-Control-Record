'use strict';

/**
 * A Feed profile's posting schedule (Evoni, 2026-10-18; services/postingSchedule):
 * social_profiles.posting_schedule JSONB NULL. Null keeps today's behaviour.
 * down: drops the column.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS posting_schedule JSONB');
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE social_profiles DROP COLUMN IF EXISTS posting_schedule');
  },
};
