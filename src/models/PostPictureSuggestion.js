// ─── PostPictureSuggestion.js ────────────────────────────────────────────────
// Visual Memory phase 4 (migration 20261019160000; services/pictureSuggestions):
// one per (post, caption) among live rows. The caption's reading, kept apart
// from feed_posts.gate_json so a re-review never erases it; the latest plan
// (recommended_action use | edit | create) and what Evoni chose (use | edit |
// create | upload), so the recommendations can be tuned.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PostPictureSuggestion extends Model {
    static associate(_models) {}
  }
  PostPictureSuggestion.init({
    id:                   { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    post_id:              { type: DataTypes.UUID, allowNull: false, references: { model: 'feed_posts', key: 'id' } },
    caption_hash:         { type: DataTypes.STRING(64), allowNull: false },
    model:                { type: DataTypes.STRING(64), allowNull: true },
    reading:              { type: DataTypes.JSONB, allowNull: false },
    recommended_action:   { type: DataTypes.STRING(10), allowNull: true },
    recommended_asset_id: { type: DataTypes.UUID, allowNull: true },
    score:                { type: DataTypes.INTEGER, allowNull: true },
    chosen_action:        { type: DataTypes.STRING(10), allowNull: true },
    chosen_asset_id:      { type: DataTypes.UUID, allowNull: true },
    result_asset_id:      { type: DataTypes.UUID, allowNull: true },
    chosen_at:            { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'PostPictureSuggestion',
    tableName: 'post_picture_suggestions', underscored: true,
    paranoid: true,
  });
  return PostPictureSuggestion;
};
