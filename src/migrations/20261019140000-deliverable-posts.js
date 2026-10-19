'use strict';

/**
 * Deliverables that check themselves (Evoni, 2026-10-19: "yes start
 * deliverables after phase 2"; services/deliverableProgress).
 *
 * deliverable_posts: which live Pulse post counts toward which deal
 * deliverable (event_deliverables). A post counts toward one deliverable at
 * most (unique on feed_post_id among live rows). Progress is computed from
 * these rows and the posts' status and format, never stored.
 * down: drops the table.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS deliverable_posts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          deliverable_id UUID NOT NULL REFERENCES event_deliverables(id) ON DELETE CASCADE,
          feed_post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
          created_by VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        )`, { transaction });
      await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS deliverable_posts_one_deal_per_post ON deliverable_posts (feed_post_id) WHERE deleted_at IS NULL',
        { transaction });
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS deliverable_posts_deliverable ON deliverable_posts (deliverable_id) WHERE deleted_at IS NULL',
        { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS deliverable_posts');
  },
};
