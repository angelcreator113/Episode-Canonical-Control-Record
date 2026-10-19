'use strict';

/**
 * Real Pulse post formats (Visual Memory phase 2; Evoni, 2026-10-19: "yes
 * start phase 2 with the post types after visual memory"):
 * feed_posts.post_format VARCHAR(20) NULL — 'post' | 'carousel' | 'story' |
 * 'video' | 'live' (services/postMedia FORMATS). Null reads as 'post', or as
 * the older post_type 'story' / 'live' / 'reel' it was drafted with. Its own
 * column because post_type already says what a post is about ('relationship'
 * and others), not how it looks. A story's 24 hours are counted from
 * posted_at, so nothing else is stored. down: drops the column.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS post_format VARCHAR(20)');
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE feed_posts DROP COLUMN IF EXISTS post_format');
  },
};
