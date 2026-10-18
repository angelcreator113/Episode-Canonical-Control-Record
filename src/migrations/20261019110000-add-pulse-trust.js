'use strict';

/**
 * Trust per character (Evoni, 2026-10-18; services/pulseTrust):
 * social_profiles.pulse_trust VARCHAR(20) NULL — 'review_all' | 'trusted' |
 * 'full'. On the Feed profile so brand accounts can be trusted too. Null is
 * 'trusted', today's rules. down: drops the column.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS pulse_trust VARCHAR(20)');
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE social_profiles DROP COLUMN IF EXISTS pulse_trust');
  },
};
