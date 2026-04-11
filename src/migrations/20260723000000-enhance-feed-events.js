'use strict';

/**
 * Enhance Feed Events — adds trending/viral mechanics, engagement velocity,
 * thread support, and event chaining to feed_posts and world_events.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── Feed Posts: trending & viral fields ──────────────────────────
    await queryInterface.addColumn('feed_posts', 'is_viral', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
    await queryInterface.addColumn('feed_posts', 'viral_reach', {
      type: Sequelize.INTEGER, allowNull: true, defaultValue: 0,
      comment: 'Extended reach beyond normal followers when post goes viral',
    });
    await queryInterface.addColumn('feed_posts', 'engagement_velocity', {
      type: Sequelize.FLOAT, allowNull: true, defaultValue: 0.0,
      comment: 'Rate of engagement growth (likes+comments per hour in first 24h)',
    });
    await queryInterface.addColumn('feed_posts', 'trending_topic', {
      type: Sequelize.STRING(100), allowNull: true,
      comment: 'Hashtag or topic this post contributed to trending',
    });
    await queryInterface.addColumn('feed_posts', 'thread_id', {
      type: Sequelize.UUID, allowNull: true,
      comment: 'Groups reply chains — all posts in a thread share the same thread_id',
    });
    await queryInterface.addColumn('feed_posts', 'parent_post_id', {
      type: Sequelize.UUID, allowNull: true,
      comment: 'Direct reply to another post (self-referencing FK)',
    });
    await queryInterface.addColumn('feed_posts', 'ripple_effect', {
      type: Sequelize.JSONB, allowNull: true,
      comment: 'How this post rippled: { spawned_posts, relationship_shifts, opportunity_triggers }',
    });
    await queryInterface.addColumn('feed_posts', 'audience_sentiment', {
      type: Sequelize.STRING(30), allowNull: true,
      comment: 'supportive | divided | hostile | curious | indifferent',
    });

    // ── World Events: event chaining fields ─────────────────────────
    await queryInterface.addColumn('world_events', 'parent_event_id', {
      type: Sequelize.UUID, allowNull: true,
      comment: 'Links to the event that spawned this one (event chaining)',
    });
    await queryInterface.addColumn('world_events', 'chain_position', {
      type: Sequelize.INTEGER, allowNull: true, defaultValue: 0,
      comment: 'Position in event chain (0=origin, 1=first sequel, etc.)',
    });
    await queryInterface.addColumn('world_events', 'chain_reason', {
      type: Sequelize.TEXT, allowNull: true,
      comment: 'Narrative explanation of why this event was spawned',
    });
    await queryInterface.addColumn('world_events', 'momentum_score', {
      type: Sequelize.FLOAT, allowNull: true, defaultValue: 0.0,
      comment: 'Cumulative score from feed engagement that influenced this event',
    });

    // ── Indexes ─────────────────────────────────────────────────────
    await queryInterface.addIndex('feed_posts', ['thread_id'], { where: { thread_id: { [Sequelize.Op.ne]: null } } });
    await queryInterface.addIndex('feed_posts', ['is_viral'], { where: { is_viral: true } });
    await queryInterface.addIndex('feed_posts', ['trending_topic'], { where: { trending_topic: { [Sequelize.Op.ne]: null } } });
    await queryInterface.addIndex('world_events', ['parent_event_id'], { where: { parent_event_id: { [Sequelize.Op.ne]: null } } });
  },

  async down(queryInterface) {
    // Feed posts
    await queryInterface.removeColumn('feed_posts', 'is_viral');
    await queryInterface.removeColumn('feed_posts', 'viral_reach');
    await queryInterface.removeColumn('feed_posts', 'engagement_velocity');
    await queryInterface.removeColumn('feed_posts', 'trending_topic');
    await queryInterface.removeColumn('feed_posts', 'thread_id');
    await queryInterface.removeColumn('feed_posts', 'parent_post_id');
    await queryInterface.removeColumn('feed_posts', 'ripple_effect');
    await queryInterface.removeColumn('feed_posts', 'audience_sentiment');
    // World events
    await queryInterface.removeColumn('world_events', 'parent_event_id');
    await queryInterface.removeColumn('world_events', 'chain_position');
    await queryInterface.removeColumn('world_events', 'chain_reason');
    await queryInterface.removeColumn('world_events', 'momentum_score');
  },
};
