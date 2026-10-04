'use strict';
const { DataTypes } = require('sequelize');

/**
 * FeedComment — a comment under a feed post, as a record with a voice
 * (the Feed project, step 4, 2026-10-04; migration 20261004170000,
 * services/feedCommentDrafter.js, docs/FEED_POSTS.md rule 6).
 * status: 'draft' (proposed, editable) or 'live' (on the feed; only deleted).
 */
module.exports = (sequelize) => {
  const FeedComment = sequelize.define('FeedComment', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    feed_post_id: { type: DataTypes.UUID, allowNull: false },
    show_id: { type: DataTypes.UUID, allowNull: false },
    social_profile_id: { type: DataTypes.INTEGER, allowNull: true },
    handle: { type: DataTypes.STRING(100), allowNull: false },
    display_name: { type: DataTypes.STRING(200), allowNull: true },
    text: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'draft', validate: { isIn: [['draft', 'live']] } },
    posted_at: { type: DataTypes.DATE, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ai_generated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    generation_model: { type: DataTypes.STRING(60), allowNull: true },
    voice_note: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'feed_comments',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  FeedComment.associate = (models) => {
    if (models.FeedPost) {
      FeedComment.belongsTo(models.FeedPost, { foreignKey: 'feed_post_id', as: 'post' });
      models.FeedPost.hasMany(FeedComment, { foreignKey: 'feed_post_id', as: 'comments' });
    }
    if (models.SocialProfile) FeedComment.belongsTo(models.SocialProfile, { foreignKey: 'social_profile_id', as: 'profile' });
  };

  return FeedComment;
};
