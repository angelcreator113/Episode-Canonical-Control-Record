'use strict';

/**
 * A post's picture is a moment from its poster's camera roll (Evoni,
 * 2026-10-19: "a text post is created it should also go through this
 * generator and create the image that goes with that post";
 * services/postPictures).
 *
 *   feed_posts.picture_job JSONB NULL      where its picture stands, made
 *       only after Evoni approves the post: { state: pending | waiting_cap |
 *       made | failed | skipped, count, estimate_usd, cost_usd, reused,
 *       moment_ids, asset_ids, error, queued_at, made_at, make_now }
 *   camera_roll_moments.post_id UUID NULL   the post a moment was made for;
 *       these moments are in the camera roll but do not count against its
 *       planned number.
 *
 * Columns only. Guarded (IF NOT EXISTS); down drops both.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query('ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS picture_job JSONB', { transaction });
      await sequelize.query(
        'ALTER TABLE camera_roll_moments ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES feed_posts(id) ON DELETE SET NULL',
        { transaction });
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS camera_roll_moments_post_id ON camera_roll_moments (post_id) WHERE post_id IS NOT NULL AND deleted_at IS NULL',
        { transaction });
    });
  },
  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query('DROP INDEX IF EXISTS camera_roll_moments_post_id', { transaction });
      await sequelize.query('ALTER TABLE camera_roll_moments DROP COLUMN IF EXISTS post_id', { transaction });
      await sequelize.query('ALTER TABLE feed_posts DROP COLUMN IF EXISTS picture_job', { transaction });
    });
  },
};
