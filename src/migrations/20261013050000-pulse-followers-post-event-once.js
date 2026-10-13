'use strict';

/**
 * Each post and each event deliverable changes followers once (Task #3086;
 * Evoni, 2026-10-13: "apply each cause once"): a unique index on the
 * pair of profile and source for the `post` and `event` causes, as
 * 20261012030000 does for `episode`. Only an index; no column changes.
 */

const TABLE = 'pulse_followers';
const INDEX = 'pulse_followers_post_event_once';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX} ON ${TABLE} (show_id, social_profile_id, cause, cause_id)
        WHERE cause IN ('post', 'event') AND deleted_at IS NULL`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${INDEX}`);
  },
};
