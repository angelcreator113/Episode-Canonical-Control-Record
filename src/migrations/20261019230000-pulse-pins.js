'use strict';

/**
 * Pinned posts on a Pulse profile (Evoni, 2026-10-19: "lets give each pulse
 * profile a gallery just like a real social media account"):
 * feed_posts.pinned_at TIMESTAMPTZ NULL. A pinned post shows first on its
 * poster's profile grid, newest pin first, at most three
 * (routes/pulseFollowsRoutes). Nothing else. down drops the column.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ');
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE feed_posts DROP COLUMN IF EXISTS pinned_at');
  },
};
