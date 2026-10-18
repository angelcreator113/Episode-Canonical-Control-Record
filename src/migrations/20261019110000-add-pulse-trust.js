'use strict';

/**
 * Trust per character (Evoni, 2026-10-18; services/pulseTrust):
 * social_profiles.pulse_trust VARCHAR(20) NULL — 'review_all' | 'trusted' |
 * 'full'. On the Feed profile so brand accounts can be trusted too. Null is
 * 'trusted', today's rules.
 * feed_comments.released_on_trust JSONB NULL — a fully trusted character's
 * comment the gate would have held records it here (comments have no
 * gate_json), so it shows in the daily update with Undo (Evoni, 2026-10-18:
 * comments follow the same trust as posts).
 * down: drops both columns.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS pulse_trust VARCHAR(20)');
    await queryInterface.sequelize.query('ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS released_on_trust JSONB');
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE feed_comments DROP COLUMN IF EXISTS released_on_trust');
    await queryInterface.sequelize.query('ALTER TABLE social_profiles DROP COLUMN IF EXISTS pulse_trust');
  },
};
