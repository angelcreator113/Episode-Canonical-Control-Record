'use strict';

/**
 * A Phone beat's story moment (Task #3111; Evoni, 2026-10-13: "pinning a
 * moment per Phone beat is the next small step"):
 *   feed_moments.story_phase  a storyClock phase (before_episode,
 *                             announced, invitation_sent, lala_arrives,
 *                             during_episode, after_episode, next_day,
 *                             week_later); NULL is During, as before.
 * The moment's story order is episode_number * 10 + its phase
 * (services/storyClock.js); the Phone tab's preview draws The Pulse as of it.
 *
 * Additive and guarded; down removes the column.
 */

const TABLE = 'feed_moments';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable(TABLE);
    if (!columns.story_phase) await queryInterface.addColumn(TABLE, 'story_phase', { type: Sequelize.STRING(20), allowNull: true });
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable(TABLE);
    if (columns.story_phase) await queryInterface.removeColumn(TABLE, 'story_phase');
  },
};
