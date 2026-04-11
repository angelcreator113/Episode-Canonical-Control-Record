'use strict';
const { DataTypes } = require('sequelize');

/**
 * FeedPost — timeline posts generated after episodes.
 * Characters react, flex, gossip, and create content in the feed.
 */
module.exports = (sequelize) => {
  const FeedPost = sequelize.define('FeedPost', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    show_id: { type: DataTypes.UUID, allowNull: false },

    episode_id: { type: DataTypes.UUID, allowNull: true },
    event_id: { type: DataTypes.UUID, allowNull: true },
    opportunity_id: { type: DataTypes.UUID, allowNull: true },

    social_profile_id: { type: DataTypes.INTEGER, allowNull: true },
    poster_handle: { type: DataTypes.STRING(100), allowNull: false },
    poster_display_name: { type: DataTypes.STRING(200), allowNull: true },
    poster_platform: { type: DataTypes.STRING(30), allowNull: true, defaultValue: 'instagram' },

    post_type: {
      type: DataTypes.STRING(30), allowNull: false, defaultValue: 'post',
      // post | story | reel | tweet | tiktok | live | dm_screenshot | notification
    },

    content_text: { type: DataTypes.TEXT, allowNull: true },
    image_description: { type: DataTypes.TEXT, allowNull: true },
    image_url: { type: DataTypes.TEXT, allowNull: true },

    likes: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    comments_count: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    shares: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    sample_comments: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },

    posted_at: { type: DataTypes.DATE, allowNull: true },
    timeline_position: {
      type: DataTypes.STRING(30), allowNull: true,
      // before_episode | during_episode | after_episode | next_day | week_later
    },

    narrative_function: {
      type: DataTypes.STRING(50), allowNull: true,
      // reaction | bts | flex | shade | support | comparison | gossip | brand_content | callback
    },

    lala_reaction: { type: DataTypes.TEXT, allowNull: true },
    lala_internal_thought: { type: DataTypes.TEXT, allowNull: true },
    emotional_impact: {
      type: DataTypes.STRING(50), allowNull: true,
      // confidence_boost | anxiety | jealousy | validation | indifference | anger
    },

    ai_generated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    generation_model: { type: DataTypes.STRING(60), allowNull: true },

    // Trending & viral mechanics
    is_viral: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    viral_reach: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    engagement_velocity: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0.0 },
    trending_topic: { type: DataTypes.STRING(100), allowNull: true },

    // Thread support
    thread_id: { type: DataTypes.UUID, allowNull: true },
    parent_post_id: { type: DataTypes.UUID, allowNull: true },

    // Ripple & sentiment
    ripple_effect: { type: DataTypes.JSONB, allowNull: true },
    audience_sentiment: { type: DataTypes.STRING(30), allowNull: true },

    sort_order: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  }, {
    tableName: 'feed_posts',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  FeedPost.associate = (models) => {
    if (models.Episode) FeedPost.belongsTo(models.Episode, { foreignKey: 'episode_id', as: 'episode' });
    if (models.SocialProfile) FeedPost.belongsTo(models.SocialProfile, { foreignKey: 'social_profile_id', as: 'socialProfile' });
    if (models.Show) FeedPost.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
  };

  return FeedPost;
};
