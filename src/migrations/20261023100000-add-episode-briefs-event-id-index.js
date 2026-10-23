'use strict';

/**
 * An index on episode_briefs.event_id (audit Low, 2026-10-23).
 *
 * The terms lock (src/utils/eventTermsLock.js findTermsLockEpisode), the
 * Place lock and the event GET look up the live brief that names an event:
 *   WHERE b.event_id = :eventId AND b.deleted_at IS NULL
 * on every event read and every term write. episode_briefs had indexes on
 * episode_id, show_id and status (20260629000000) but none on event_id, so
 * each lookup scanned the table.
 *
 * IF NOT EXISTS: a hand-made index of this name is left as it is. The down
 * drops only this index.
 */
const INDEX_NAME = 'idx_episode_briefs_event_id';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS ${INDEX_NAME} ON episode_briefs (event_id)`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${INDEX_NAME}`);
  },
};
